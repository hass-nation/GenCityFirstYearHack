"""Production entry point for the Snowflake-hosted demo."""

import os
from pathlib import Path
import secrets

from flask import abort, request

instance = Path(os.environ.get("PC_PET_INSTANCE_PATH", "/data"))
instance.mkdir(parents=True, exist_ok=True)
secret_file = instance / "flask-session.key"
if not secret_file.exists():
    with secret_file.open("x", encoding="utf-8") as handle:
        handle.write(secrets.token_hex(32))
os.environ.setdefault("SECRET_KEY", secret_file.read_text(encoding="utf-8").strip())

from app import create_app

app = create_app()
app.config["SESSION_COOKIE_SECURE"] = True


@app.before_request
def local_features_only():
    if request.path.startswith(("/api/activity/", "/api/desktop-pet")):
        abort(404)
