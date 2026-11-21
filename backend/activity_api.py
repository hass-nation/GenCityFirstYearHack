"""Collect foreground activity on the same Windows PC as the planner."""

from ipaddress import ip_address
import subprocess
from threading import Lock
from urllib.parse import urlsplit

from flask import Blueprint, jsonify, request

from backend.live_usage import capture_sessions
from backend.windows_activity import list_open_app_tabs


activity_api = Blueprint("activity_api", __name__, url_prefix="/api/activity")
capture_lock = Lock()
tabs_lock = Lock()


def _local_request_error():
    try:
        origin = urlsplit(request.headers.get("Origin", ""))
        local = ip_address(request.remote_addr or "").is_loopback
    except ValueError:
        local = False
    if (not local or origin.hostname not in {"localhost", "127.0.0.1", "::1"}
            or origin.netloc != request.host or origin.scheme not in {"http", "https"}):
        return jsonify(error="Open the planner on the Windows PC running Flask."), 403
    if not request.is_json:
        return jsonify(error="Start tracking from the planner's Activity page."), 415


@activity_api.post("/capture")
def capture():
    if error := _local_request_error():
        return error
    if not capture_lock.acquire(blocking=False):
        return jsonify(error="A capture is already running. Wait a few seconds before restarting."), 409
    try:
        apps, _ = capture_sessions(seconds=2)
    except OSError:
        return jsonify(error="Foreground tracking needs Flask running on an interactive Windows PC."), 503
    finally:
        capture_lock.release()
    response = jsonify(apps=apps)
    response.headers["Cache-Control"] = "no-store"
    return response


@activity_api.post("/tabs")
def tabs():
    if error := _local_request_error():
        return error
    if not tabs_lock.acquire(blocking=False):
        return jsonify(error="A tab scan is already running."), 409
    try:
        windows = list_open_app_tabs()
    except (OSError, subprocess.SubprocessError, ValueError):
        return jsonify(error="Windows could not read open tabs."), 503
    finally:
        tabs_lock.release()
    response = jsonify(windows=windows)
    response.headers["Cache-Control"] = "no-store"
    return response
