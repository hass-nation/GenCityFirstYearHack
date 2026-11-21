"""Authenticated invite-code parties and a shared focus countdown."""

import re
import secrets
import time

from flask import Blueprint, g, jsonify, request

from backend.api import database, require_user


parties = Blueprint("parties", __name__, url_prefix="/api/parties")
FOCUS_DURATION_MS = 25 * 60 * 1000


def _now():
    return time.time_ns() // 1_000_000


def _current(connection):
    return connection.execute(
        "SELECT p.* FROM parties p JOIN party_members m ON m.party_code = p.code WHERE m.user_id = ?",
        (g.user["id"],),
    ).fetchone()


def _members(connection, code):
    return connection.execute(
        """SELECT u.id, u.display_name, u.pet_avatar, m.ready
           FROM party_members m JOIN users u ON u.id = m.user_id
           WHERE m.party_code = ? ORDER BY m.rowid""",
        (code,),
    ).fetchall()


def _view(connection, party):
    if party is None:
        return None
    now = _now()
    ends_at = party["ends_at"]
    return {
        **dict(party),
        "status": "lobby" if ends_at is None else "active" if ends_at > now else "finished",
        "server_time": now,
        "members": [{**dict(member), "ready": bool(member["ready"])} for member in _members(connection, party["code"])],
    }


@parties.get("/current")
@require_user
def current_party():
    connection = database()
    return jsonify(party=_view(connection, _current(connection)))


@parties.post("")
@require_user
def create_party():
    connection = database()
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        if _current(connection):
            return jsonify(error="Leave your current party first."), 409
        while True:
            code = secrets.token_hex(5).upper()
            inserted = connection.execute("INSERT OR IGNORE INTO parties (code, host_id) VALUES (?, ?)", (code, g.user["id"]))
            if inserted.rowcount:
                break
        connection.execute("INSERT INTO party_members (user_id, party_code) VALUES (?, ?)", (g.user["id"], code))
        return jsonify(party=_view(connection, _current(connection))), 201


@parties.post("/join")
@require_user
def join_party():
    payload = request.get_json(silent=True)
    code = str(payload.get("code", "")).strip().upper() if isinstance(payload, dict) else ""
    if not re.fullmatch(r"[0-9A-F]{10}", code):
        return jsonify(error="Enter a 10-character party code."), 400
    connection = database()
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        current = _current(connection)
        if current is not None:
            if current["code"] == code:
                return jsonify(party=_view(connection, current))
            return jsonify(error="Leave your current party first."), 409
        party = connection.execute("SELECT * FROM parties WHERE code = ?", (code,)).fetchone()
        if party is None:
            return jsonify(error="That party code could not be found."), 404
        if party["ends_at"] is not None:
            return jsonify(error="This party has started. Ask the host to reopen the lobby."), 409
        connection.execute("INSERT INTO party_members (user_id, party_code) VALUES (?, ?)", (g.user["id"], code))
        return jsonify(party=_view(connection, party))


@parties.patch("/current")
@require_user
def update_party():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or payload.get("action") not in ("ready", "start", "reset"):
        return jsonify(error="Choose a valid party action."), 400
    action = payload["action"]
    connection = database()
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        party = _current(connection)
        if party is None:
            return jsonify(error="Join a party first."), 404
        code = party["code"]
        if action == "ready":
            if not isinstance(payload.get("ready"), bool):
                return jsonify(error="Set ready to true or false."), 400
            if party["ends_at"] is not None:
                return jsonify(error="The lobby is closed during the session."), 409
            connection.execute("UPDATE party_members SET ready = ? WHERE user_id = ?", (payload["ready"], g.user["id"]))
        else:
            if party["host_id"] != g.user["id"]:
                return jsonify(error="Only the party host can manage the countdown."), 403
            if action == "start":
                members = _members(connection, code)
                if party["ends_at"] is not None or len(members) < 2 or not all(member["ready"] for member in members):
                    return jsonify(error="At least two players must join, and everyone must be ready."), 409
                connection.execute("UPDATE parties SET ends_at = ? WHERE code = ?", (_now() + FOCUS_DURATION_MS, code))
            else:
                connection.execute("UPDATE parties SET ends_at = NULL WHERE code = ?", (code,))
                connection.execute("UPDATE party_members SET ready = 0 WHERE party_code = ?", (code,))
        return jsonify(party=_view(connection, _current(connection)))


@parties.delete("/current")
@require_user
def leave_party():
    connection = database()
    with connection:
        connection.execute("BEGIN IMMEDIATE")
        party = _current(connection)
        if party is None:
            return jsonify(party=None)
        code = party["code"]
        connection.execute("DELETE FROM party_members WHERE user_id = ?", (g.user["id"],))
        members = _members(connection, code)
        if not members:
            connection.execute("DELETE FROM parties WHERE code = ?", (code,))
        elif party["host_id"] == g.user["id"]:
            connection.execute("UPDATE parties SET host_id = ? WHERE code = ?", (members[0]["id"], code))
        return jsonify(party=None)
