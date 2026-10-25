# ============================================================================
# FILE: app/__init__.py
# PURPOSE: The application factory. Builds and configures the Flask app:
#   - loads config
#   - initialises extensions (db, migrate, jwt, cors, limiter)
#   - registers blueprints
#   - installs global error handlers + JWT error handlers
#   - installs audit middleware (logs state-changing requests)
# ============================================================================
from flask import Flask, jsonify, request

from config import get_config
from app.extensions import db, migrate, jwt, cors, limiter


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or get_config())

    # ---- Initialise extensions ----
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    # CORS limited to the configured frontend origin(s) only.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}},
        supports_credentials=True,
    )

    # Make sure models are imported so migrations detect them.
    from app import models  # noqa: F401

    # ---- Register blueprints ----
    from app.auth import auth_bp
    app.register_blueprint(auth_bp)

    # NOTE: staff / departments / shifts / users / biometrics / attendance /
    # reports / audit blueprints are added in the NEXT modules.
    _try_register_optional_blueprints(app)

    # ---- JWT error handlers (clean JSON instead of HTML) ----
    _register_jwt_handlers()

    # ---- Generic error handlers ----
    _register_error_handlers(app)

    # ---- Audit middleware ----
    _register_audit_middleware(app)

    # ---- Force password change middleware ----
    _register_force_change_middleware(app)

    # ---- Health check ----
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "gvu-attendance-api"}), 200

    return app


def _try_register_optional_blueprints(app):
    """
    Register feature blueprints if they exist yet. This lets the app run after
    Module 1 (auth only) and automatically pick up later modules once added.
    """
    optional = [
        ("app.staff.routes", "staff_bp"),
        ("app.departments.routes", "departments_bp"),
        ("app.shifts.routes", "shifts_bp"),
        ("app.users.routes", "users_bp"),
        ("app.biometrics.routes", "biometrics_bp"),
        ("app.attendance.routes", "attendance_bp"),
        ("app.dashboard.routes", "dashboard_bp"),
        ("app.reports.routes", "reports_bp"),
        ("app.audit.routes", "audit_bp"),
        ("app.password_requests.routes", "password_requests_bp"),
        ("app.system.routes", "system_bp"),
        ("app.settings.routes", "settings_bp"),
        ("app.absent_job.routes", "absent_job_bp"),
        ("app.imports.routes", "imports_bp"),
    ]
    for module_path, bp_name in optional:
        try:
            module = __import__(module_path, fromlist=[bp_name])
            app.register_blueprint(getattr(module, bp_name))
        except Exception:
            # Not built yet — safe to ignore until that module is created.
            pass


def _register_jwt_handlers():
    # Reject tokens whose session epoch is older than the user's current epoch.
    # The admin password reset bumps session_epoch, invalidating old sessions.
    @jwt.token_verification_loader
    def _check_epoch(_jwt_header, jwt_payload) -> bool:
        from app.models import User
        uid = jwt_payload.get("sub")
        token_epoch = jwt_payload.get("epoch", 0)
        if uid is None:
            return False
        user = User.query.get(int(uid))
        if not user:
            return False
        return (user.session_epoch or 0) == token_epoch

    @jwt.token_verification_failed_loader
    def _epoch_failed(_jwt_header, _jwt_payload):
        return jsonify({"error": "Unauthorized",
                        "message": "Session expired (password was reset). Please log in again."}), 401

    @jwt.unauthorized_loader
    def _missing(reason):
        return jsonify({"error": "Unauthorized", "message": "Missing or invalid token"}), 401

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify({"error": "Unauthorized", "message": "Invalid token"}), 401

    @jwt.expired_token_loader
    def _expired(_h, _p):
        return jsonify({"error": "Unauthorized", "message": "Token has expired"}), 401

    @jwt.revoked_token_loader
    def _revoked(_h, _p):
        return jsonify({"error": "Unauthorized", "message": "Token has been revoked"}), 401


def _register_error_handlers(app):
    @app.errorhandler(400)
    def _bad_request(e):
        return jsonify({"error": "BadRequest", "message": str(getattr(e, "description", e))}), 400

    @app.errorhandler(404)
    def _not_found(e):
        return jsonify({"error": "NotFound", "message": "Resource not found"}), 404

    @app.errorhandler(429)
    def _rate_limited(e):
        return jsonify({"error": "TooManyRequests",
                        "message": "Rate limit exceeded. Please slow down."}), 429

    @app.errorhandler(500)
    def _server_error(e):
        # Never leak internals to the client.
        db.session.rollback()
        return jsonify({"error": "ServerError", "message": "An unexpected error occurred"}), 500


def _register_force_change_middleware(app):
    """
    If the logged-in user has must_change_password = True, block every API route
    EXCEPT the ones they need to change it (and log out / see themselves).
    This enforces "block access to everything until the password is changed".
    """
    from flask_jwt_extended import verify_jwt_in_request, get_jwt
    from flask import request

    ALLOWED = {
        "/api/auth/change-password",
        "/api/auth/logout",
        "/api/auth/me",
        "/api/health",
    }

    @app.before_request
    def _enforce_change():
        if request.method == "OPTIONS":
            return  # let CORS preflight through
        if not request.path.startswith("/api/") or request.path in ALLOWED:
            return
        try:
            verify_jwt_in_request(optional=True)
            claims = get_jwt() or {}
        except Exception:
            return  # no/invalid token -> normal auth handling elsewhere
        uid = claims.get("sub")
        if not uid:
            return
        # Check the LIVE DB value (not the stale token) so it clears after change.
        from app.models import User
        user = User.query.get(int(uid))
        if user and user.must_change_password:
            return jsonify({
                "error": "PasswordChangeRequired",
                "message": "You must change your temporary password before continuing.",
            }), 403


def _register_audit_middleware(app):
    """
    After every successful state-changing request (POST/PUT/PATCH/DELETE),
    write a lightweight audit row. Detailed audits are also written inside
    specific routes; this is the safety net that guarantees coverage.
    """
    from app.utils.audit import record_audit
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

    # Routes that already write their own detailed audit (skip double logging).
    SKIP_PATHS = {"/api/auth/login", "/api/auth/logout", "/api/auth/refresh"}

    @app.after_request
    def _audit(response):
        try:
            if request.method in ("POST", "PUT", "PATCH", "DELETE") \
                    and 200 <= response.status_code < 400 \
                    and request.path.startswith("/api/") \
                    and request.path not in SKIP_PATHS:
                # Only log if a valid JWT is present (don't crash otherwise).
                try:
                    verify_jwt_in_request(optional=True)
                    uid = get_jwt_identity()
                    uid = int(uid) if uid is not None else None
                except Exception:
                    uid = None
                record_audit(
                    action=f"{request.method} {request.path}",
                    details=f"status {response.status_code}",
                    user_id=uid,
                )
        except Exception:
            # Never let auditing break the actual response.
            db.session.rollback()
        return response
