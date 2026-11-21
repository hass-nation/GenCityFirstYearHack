from __future__ import annotations

import os
import secrets
from pathlib import Path

from flask import Flask, request, send_from_directory

from backend.api import api
from backend.activity_api import activity_api
from backend.parties import parties
from .chat import pet_chat


def create_app(frontend_dir: Path | None = None) -> Flask:
    root = Path(__file__).resolve().parent.parent
    app = Flask(__name__, instance_path=str(root / "instance"))
    app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    allowed_origins = set(filter(None, os.environ.get("CORS_ORIGINS", "https://hass-nation.github.io,http://localhost:5173,http://127.0.0.1:5173").split(",")))
    app.register_blueprint(api)
    app.register_blueprint(activity_api)
    app.register_blueprint(parties)
    app.register_blueprint(pet_chat)

    @app.after_request
    def cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        return response
    dist = (root / frontend_dir).resolve() if frontend_dir is not None else root / "dist"

    @app.get("/")
    def home():
        if not (dist / "index.html").is_file():
            return "Frontend build missing. Run npm install and npm run build.", 503
        return send_from_directory(dist, "index.html")

    @app.get("/assets/<path:filename>")
    @app.get("/GenCityFirstYearHack/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(dist / "assets", filename)

    return app


app = create_app()
