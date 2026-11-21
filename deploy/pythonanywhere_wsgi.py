"""PythonAnywhere WSGI entry point for the Flask API.

Before publishing, set project_home to the deployed checkout path and set
FLASK_SECRET_KEY in PythonAnywhere's environment settings. Keep the SQLite
database outside the code checkout so releases preserve account data.
"""

import os
import sys
from pathlib import Path

project_home = "/home/YOUR_USERNAME/GenCityFirstYearHack"
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.environ.setdefault("DATABASE_PATH", "/home/YOUR_USERNAME/.local/share/gencity/gencity.sqlite3")
os.environ.setdefault("CORS_ORIGINS", "https://hass-nation.github.io")
Path(os.environ["DATABASE_PATH"]).parent.mkdir(parents=True, exist_ok=True)

from app import app as application  # noqa: E402
