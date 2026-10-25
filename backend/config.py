# ============================================================================
# FILE: config.py
# PURPOSE: Central configuration. Reads everything from environment variables
#          (loaded from .env) so NO secret is ever hard-coded.
# ============================================================================
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load variables from .env into os.environ (only if the file exists).
load_dotenv()


def _int(name: str, default: int) -> int:
    """Read an int env var safely, falling back to a default."""
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class BaseConfig:
    """Settings shared by every environment."""

    # --- Core ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://gvu_user:gvu_password@localhost:3306/gvu_attendance",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Recycle idle MySQL connections so they don't go stale (prevents 2006 errors).
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_recycle": 280, "pool_pre_ping": True}

    # --- JWT ---
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_int("JWT_ACCESS_TOKEN_MINUTES", 30))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=_int("JWT_REFRESH_TOKEN_DAYS", 7))

    # --- Biometric encryption + adapter ---
    BIOMETRIC_ENC_KEY = os.getenv("BIOMETRIC_ENC_KEY", "")
    BIOMETRIC_ADAPTER = os.getenv("BIOMETRIC_ADAPTER", "simulated")
    MATCH_THRESHOLD = _int("MATCH_THRESHOLD", 55)

    # --- CORS ---
    FRONTEND_ORIGINS = [
        o.strip()
        for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]

    # --- Login security ---
    LOGIN_MAX_ATTEMPTS = _int("LOGIN_MAX_ATTEMPTS", 5)
    LOGIN_LOCKOUT_MINUTES = _int("LOGIN_LOCKOUT_MINUTES", 15)
    RATELIMIT_LOGIN = os.getenv("RATELIMIT_LOGIN", "10 per minute")
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")

    # --- Password reset ---
    RESET_TOKEN_MINUTES = _int("RESET_TOKEN_MINUTES", 30)

    # --- OpenAPI / Swagger (flask-smorest) ---
    API_TITLE = "GVU Biometric Staff Attendance API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/"
    OPENAPI_SWAGGER_UI_PATH = "/docs"          # Swagger UI at /docs
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"
    # Tell Swagger UI how to send the JWT (Authorization: Bearer <token>)
    API_SPEC_OPTIONS = {
        "security": [{"bearerAuth": []}],
        "components": {
            "securitySchemes": {
                "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
            }
        },
    }


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False
    # In production you should serve behind HTTPS (see README "HTTPS notes").


class TestingConfig(BaseConfig):
    """Used by pytest. Uses an in-memory SQLite DB so tests need no MySQL."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    # A fixed valid Fernet key so encryption works during tests.
    BIOMETRIC_ENC_KEY = "9Km_mXynIIQvAk5XwxPh4QFbZ8DnGuF4DfhiHCcOfNM="
    BIOMETRIC_ADAPTER = "simulated"
    RATELIMIT_LOGIN = "1000 per minute"  # don't rate-limit during tests


# Map FLASK_ENV -> config class
def get_config():
    env = os.getenv("FLASK_ENV", "development").lower()
    if env == "production":
        return ProductionConfig
    if env == "testing":
        return TestingConfig
    return DevelopmentConfig
