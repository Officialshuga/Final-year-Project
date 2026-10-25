# ============================================================================
# BLUEPRINT: biometrics  (prefix: /api/biometrics)
# Enrol fingerprints, list enrolled fingers, delete/re-enrol.
# ----------------------------------------------------------------------------
# ACCESS:
#   - Admin may enrol/list/delete for ANY staff member.
#   - Staff may enrol/list/delete ONLY for themselves (ownership enforced).
# SECURITY:
#   - Templates are ENCRYPTED (AES/Fernet) before saving.
#   - Raw template data is NEVER returned by any endpoint.
# ============================================================================
import base64
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import BiometricTemplate, Staff
from app.utils.security import roles_required, ensure_self_or_admin
from app.utils.audit import record_audit
from app.utils.crypto import encrypt_bytes

biometrics_bp = Blueprint("biometrics", __name__, url_prefix="/api/biometrics")


def _merge_samples(good_samples):
    """
    Combine 2–3 good samples into one enrolment template.
    - With the ZK SDK we call DBMerge(t1,t2,t3) for a stronger template.
    - Otherwise we keep the highest-quality sample.
    Returns (template_base64, quality).
    """
    best = max(good_samples, key=lambda s: s.get("quality", 0))
    try:
        adapter = current_app.config.get("BIOMETRIC_ADAPTER", "simulated").lower()
        if adapter == "zkteco":
            from zkfp import ZKFP2
            zk = ZKFP2(); zk.Init()
            raws = [base64.b64decode(s["template"]) for s in good_samples[:3]]
            while len(raws) < 3:
                raws.append(raws[-1])  # DBMerge expects 3 inputs
            merged = zk.DBMerge(raws[0], raws[1], raws[2])
            return base64.b64encode(bytes(merged)).decode(), best.get("quality", 0)
    except Exception:
        # Any SDK issue -> safely fall back to the best single sample.
        pass
    return best["template"], best.get("quality", 0)

VALID_FINGERS = {
    "Right Thumb", "Right Index", "Right Middle", "Right Ring", "Right Little",
    "Left Thumb", "Left Index", "Left Middle", "Left Ring", "Left Little",
}


# ----------------------------------------------------------------------------
# LIST enrolled fingers for a staff member
# ----------------------------------------------------------------------------
@biometrics_bp.get("/staff/<int:staff_id>")
@jwt_required()
@roles_required("admin", "staff")
def list_fingers(staff_id):
    denied = ensure_self_or_admin(staff_id)
    if denied:
        return denied
    Staff.query.get_or_404(staff_id)
    rows = BiometricTemplate.query.filter_by(staff_id=staff_id).all()
    # to_dict() omits raw template_data by design.
    return jsonify({"templates": [t.to_dict() for t in rows]}), 200


# ----------------------------------------------------------------------------
# ENROL a fingerprint (create or re-enrol an existing finger)
# Body (single sample, original):
#   { staff_id, finger_type, template (base64), quality_score? }
# Body (multi-sample from the real sensor, NEW — optional):
#   { staff_id, finger_type, samples: [ {template, quality}, ... ] }
#   -> we reject low-quality samples, then merge (ZK) or keep the best sample.
# ----------------------------------------------------------------------------
@biometrics_bp.post("/enroll")
@jwt_required()
@roles_required("admin", "staff")
def enroll():
    data = request.get_json(silent=True) or {}
    staff_id = data.get("staff_id")
    finger = (data.get("finger_type") or "").strip()
    template_str = data.get("template")
    quality = data.get("quality_score")
    samples = data.get("samples")  # optional list for real-sensor multi-capture

    if not staff_id:
        return jsonify({"error": "Validation", "message": "staff_id is required"}), 400

    # Ownership: staff can only enrol themselves.
    denied = ensure_self_or_admin(staff_id)
    if denied:
        return denied

    staff = Staff.query.get_or_404(staff_id)
    if finger not in VALID_FINGERS:
        return jsonify({"error": "Validation", "message": f"finger_type must be one of {sorted(VALID_FINGERS)}"}), 400

    # --- NEW: multi-sample path (2–3 captures from the real sensor) ---
    if samples and isinstance(samples, list):
        min_q = current_app.config.get("MATCH_THRESHOLD", 55)
        good = [s for s in samples if s.get("template") and (s.get("quality") or 0) >= min_q]
        if len(good) < 2:
            return jsonify({"error": "LowQuality",
                            "message": "Not enough good-quality samples. Please scan again."}), 422
        # Try to MERGE samples with the SDK (ZK DBMerge); fall back to best sample.
        merged_b64, quality = _merge_samples(good)
        raw_bytes = merged_b64.encode()
        encrypted = encrypt_bytes(raw_bytes)
    else:
        # --- Original single-sample path (unchanged) ---
        if not template_str:
            return jsonify({"error": "Validation", "message": "template is required"}), 400
        raw_bytes = template_str.encode() if isinstance(template_str, str) else bytes(template_str)
        encrypted = encrypt_bytes(raw_bytes)

    # Create or overwrite (re-enrol) the finger.
    existing = BiometricTemplate.query.filter_by(staff_id=staff_id, finger_type=finger).first()
    if existing:
        existing.template_data = encrypted
        existing.quality_score = quality
        existing.date_enrolled = datetime.utcnow()
        action, msg = "RE_ENROLL_BIOMETRIC", f"Re-enrolled {finger} for {staff.full_name}"
        tmpl = existing
    else:
        tmpl = BiometricTemplate(
            staff_id=staff_id, finger_type=finger,
            template_data=encrypted, quality_score=quality,
            date_enrolled=datetime.utcnow(),
        )
        db.session.add(tmpl)
        action, msg = "ENROLL_BIOMETRIC", f"Enrolled {finger} for {staff.full_name}"

    db.session.commit()
    # Enrolment changed -> drop the in-memory match cache so it rebuilds.
    from .template_cache import invalidate
    invalidate()
    record_audit(action, "biometric_templates", msg)
    return jsonify({"template": tmpl.to_dict(), "message": "Enrolment successful"}), 201


# ----------------------------------------------------------------------------
# DELETE an enrolled finger
# ----------------------------------------------------------------------------
@biometrics_bp.delete("/<int:template_id>")
@jwt_required()
@roles_required("admin", "staff")
def delete_finger(template_id):
    t = BiometricTemplate.query.get_or_404(template_id)
    denied = ensure_self_or_admin(t.staff_id)
    if denied:
        return denied
    finger = t.finger_type
    sid = t.staff_id
    db.session.delete(t)
    db.session.commit()
    from .template_cache import invalidate
    invalidate()  # enrolment changed -> rebuild match cache next scan
    record_audit("DELETE_BIOMETRIC", "biometric_templates", f"Deleted {finger} for staff #{sid}")
    return jsonify({"message": "Fingerprint template deleted"}), 200
