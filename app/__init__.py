from __future__ import annotations

import os
import secrets
from pathlib import Path

from flask import Flask, send_from_directory

from backend.api import api
from backend.activity_api import activity_api
from backend.parties import parties
from .chat import pet_chat


def create_app(frontend_dir: Path | None = None) -> Flask:
    root = Path(__file__).resolve().parent.parent
    app = Flask(__name__, instance_path=str(root / "instance"))
    app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    app.register_blueprint(api)
    app.register_blueprint(activity_api)
    app.register_blueprint(parties)
    app.register_blueprint(pet_chat)
    dist = (root / frontend_dir).resolve() if frontend_dir is not None else root / "dist"

    @app.get("/")
    def home():
        if not (dist / "index.html").is_file():
            return "Frontend build missing. Run npm install and npm run build.", 503
        return send_from_directory(dist, "index.html")

    @app.get("/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(dist / "assets", filename)

    return app


app = create_app()
