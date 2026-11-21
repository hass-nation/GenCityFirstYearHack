"""Share the local planner's companion with the desktop walker."""

from base64 import b64decode
from binascii import Error
from ipaddress import ip_address
import json
from pathlib import Path
from struct import unpack
from tempfile import NamedTemporaryFile
from time import time
from urllib.parse import urlsplit
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request

desktop_pet = Blueprint("desktop_pet", __name__)
_DEFAULT = {"name": "Wobbles", "species": "camel"}
_LOOPBACK = {"localhost", "127.0.0.1", "::1"}
_PREFIX = "data:image/png;base64,"


def _local_request():
    try:
        host = urlsplit(f"//{request.host}")
        origin_header = request.headers.get("Origin", "")
        origin = urlsplit(origin_header)
        if not ip_address(request.remote_addr or "").is_loopback or host.hostname not in _LOOPBACK:
            return False
        if request.method == "GET" and not origin_header:
            return True
        return origin.scheme in {"http", "https"} and origin.netloc == request.host
    except ValueError:
        return False


def _frame_valid(frame):
    if not isinstance(frame, str) or len(frame) > 28000 or not frame.startswith(_PREFIX):
        return False
    try:
        png = b64decode(frame[len(_PREFIX):], validate=True)
    except Error:
        return False
    if len(png) < 33 or png[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
        return False
    return unpack(">II", png[16:24]) == (64, 64)


def _save(path, appearance):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as temporary:
        pending = Path(temporary.name)
        try:
            json.dump(appearance, temporary)
            temporary.close()
            pending.replace(path)
        finally:
            pending.unlink(missing_ok=True)


@desktop_pet.route("/api/desktop-pet", methods=["GET", "PUT", "POST"])
def companion():
    if not _local_request():
        return jsonify(error="Open the planner on the same computer as the desktop pet."), 403

    path = Path(current_app.instance_path) / "desktop-pet.json"
    if request.method == "GET":
        try:
            appearance = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            appearance = _DEFAULT
        speech = current_app.extensions.get("desktop_pet_speech")
        response = jsonify(appearance=appearance, speech=speech if speech and speech["expires"] > time() else None)
        response.headers["Cache-Control"] = "no-store"
        return response

    request.max_content_length = 58000
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Send a desktop pet update."), 400

    if request.method == "POST":
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip() or len(text) > 280:
            return jsonify(error="Send a message of 280 characters or fewer."), 400
        current_app.extensions["desktop_pet_speech"] = {"id": uuid4().hex, "text": text, "expires": time() + 12}
        return "", 204

    name, species = payload.get("name"), payload.get("species")
    if not isinstance(name, str) or not name.strip() or len(name) > 32 or species not in ("camel", "cat", "dog", "custom"):
        return jsonify(error="Choose a companion and enter its name."), 400
    appearance = {"name": name.strip(), "species": species}
    if species == "custom":
        frames = payload.get("frames")
        if not isinstance(frames, list) or len(frames) != 2 or not all(map(_frame_valid, frames)):
            return jsonify(error="Upload two valid sprite frames."), 400
        appearance["frames"] = frames
    _save(path, appearance)
    return "", 204
