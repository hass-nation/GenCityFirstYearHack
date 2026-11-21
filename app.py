from pathlib import Path

from flask import Flask, send_from_directory

from backend.api import api


def create_app(frontend_dir: Path | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
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

    return app


app = create_app()
