from __future__ import annotations

from pathlib import Path
import os

from flask import Flask, request, send_from_directory

from backend.api import api


def create_app(frontend_dir: Path | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config["DATABASE_PATH"] = os.environ.get("DATABASE_PATH", str(Path(app.instance_path) / "gencity.sqlite3"))
    allowed_origins = {origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()}
    app.register_blueprint(api)
    dist = frontend_dir if frontend_dir is not None else Path(app.root_path) / "dist"

    @app.get("/")
    def home():
        if not (dist / "index.html").is_file():
            return "Frontend build missing. Run npm install and npm run build.", 503
        return send_from_directory(dist, "index.html")

    @app.get("/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(dist / "assets", filename)

    @app.after_request
    def cors(response):
        origin = request.headers.get("Origin", "")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
        return response

    return app


app = create_app()
