"""PythonAnywhere WSGI entry point template.

Set ``project_home`` to the checked-out repository path and replace the CORS
origin if the Pages owner or repository path changes.
"""

import os
import sys
from pathlib import Path

project_home = "/home/YOUR_USERNAME/GenCityFirstYearHack"
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.environ["DATABASE_PATH"] = "/home/YOUR_USERNAME/.local/share/gencity/gencity.sqlite3"
os.environ["CORS_ORIGINS"] = "https://hass-nation.github.io"
Path(os.environ["DATABASE_PATH"]).parent.mkdir(parents=True, exist_ok=True)

from app import app as application  # noqa: E402
