# ============================================================================
# FILE: app/extensions.py
# PURPOSE: Create Flask extension objects ONCE here, then initialise them with
#          the app inside the app factory (app/__init__.py). This avoids
#          circular imports — models import `db` from here, not from the app.
# ============================================================================
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Database ORM
db = SQLAlchemy()

# Alembic-based migrations (flask db init / migrate / upgrade)
migrate = Migrate()

# JWT auth (access + refresh tokens)
jwt = JWTManager()

# CORS (configured with the real origins inside the factory)
cors = CORS()

# Rate limiter — keyed by client IP. Used mainly to protect the login route.
limiter = Limiter(key_func=get_remote_address)
