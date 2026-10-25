# ============================================================================
# FILE: wsgi.py
# PURPOSE: Entry point used by `flask` CLI and by WSGI servers (gunicorn).
#   Development:  flask --app wsgi run   (or:  python wsgi.py)
#   Production:   gunicorn "wsgi:app" --bind 0.0.0.0:8000 --workers 4
# ============================================================================
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Development server only. Use gunicorn/uwsgi behind HTTPS in production.
    app.run(host="0.0.0.0", port=8000, debug=True)
