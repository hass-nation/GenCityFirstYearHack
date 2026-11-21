"""Small SQLite-backed profile and friend messaging API for the demo."""

from __future__ import annotations

from functools import wraps
import hashlib
import re
import secrets
import sqlite3
from typing import Any
from uuid import uuid4

from flask import Blueprint, current_app, g, jsonify, request

api = Blueprint("api", __name__, url_prefix="/api")


def database() -> sqlite3.Connection:
    if "database" not in g:
        from pathlib import Path

        Path(current_app.instance_path).mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(Path(current_app.instance_path) / "gencity.sqlite3")
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                friend_code TEXT NOT NULL UNIQUE,
                token_hash TEXT NOT NULL UNIQUE,
                pet_name TEXT NOT NULL DEFAULT 'Biscuit',
                pet_avatar TEXT NOT NULL DEFAULT '🐶',
                pet_theme TEXT NOT NULL DEFAULT 'lavender',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS friends (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, friend_id),
                CHECK (user_id <> friend_id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS messages_inbox ON messages(recipient_id, id);
            """
        )
        g.database = connection
    return g.database


@api.teardown_app_request
def close_database(_error: BaseException | None) -> None:
    connection = g.pop("database", None)
    if connection is not None:
        connection.close()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def current_user() -> sqlite3.Row | None:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return database().execute(
        "SELECT * FROM users WHERE token_hash = ?", (token_digest(token),)
    ).fetchone()


def require_user(handler: Any) -> Any:
    @wraps(handler)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        user = current_user()
        if user is None:
            return jsonify({"error": "Sign in with your companion profile first."}), 401
        g.user = user
        return handler(*args, **kwargs)

    return wrapped


def public_profile(user: sqlite3.Row) -> dict[str, str]:
    return {
        "id": user["id"],
        "display_name": user["display_name"],
        "friend_code": user["friend_code"],
        "pet_name": user["pet_name"],
        "pet_avatar": user["pet_avatar"],
        "pet_theme": user["pet_theme"],
    }


def new_friend_code(connection: sqlite3.Connection) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        if connection.execute("SELECT 1 FROM users WHERE friend_code = ?", (code,)).fetchone() is None:
            return code


@api.get("/health")
def health():
    return {"status": "ok"}


@api.post("/users")
def create_user():
    payload = request.get_json(silent=True) or {}
    display_name = str(payload.get("display_name", "")).strip()
    if not display_name or len(display_name) > 24:
        return jsonify({"error": "Choose a display name of 1–24 characters."}), 400

    connection = database()
    user_id = str(uuid4())
    token = secrets.token_urlsafe(32)
    friend_code = new_friend_code(connection)
    connection.execute(
        "INSERT INTO users (id, display_name, friend_code, token_hash) VALUES (?, ?, ?, ?)",
        (user_id, display_name, friend_code, token_digest(token)),
    )
    connection.commit()
    user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return jsonify({"token": token, "profile": public_profile(user)}), 201


@api.get("/me")
@require_user
def get_me():
    return jsonify({"profile": public_profile(g.user)})


@api.patch("/me/pet")
@require_user
def update_pet():
    payload = request.get_json(silent=True) or {}
    updates: dict[str, str] = {}
    for field, max_length in (("pet_name", 16), ("pet_avatar", 24)):
        if field in payload:
            value = str(payload[field]).strip()
            if not value or len(value) > max_length:
                return jsonify({"error": f"{field} must be 1–{max_length} characters."}), 400
            updates[field] = value
    if "pet_theme" in payload:
        theme = str(payload["pet_theme"])
        if theme not in {"lavender", "meadow", "sunset"}:
            return jsonify({"error": "Choose a supported pet room theme."}), 400
        updates["pet_theme"] = theme
    if not updates:
        return jsonify({"error": "Choose at least one pet setting to update."}), 400

    assignments = ", ".join(f"{key} = ?" for key in updates)
    connection = database()
    connection.execute(
        f"UPDATE users SET {assignments} WHERE id = ?", (*updates.values(), g.user["id"])
    )
    connection.commit()
    user = connection.execute("SELECT * FROM users WHERE id = ?", (g.user["id"],)).fetchone()
    return jsonify({"profile": public_profile(user)})


@api.get("/friends")
@require_user
def list_friends():
    rows = database().execute(
        """SELECT u.* FROM friends f JOIN users u ON u.id = f.friend_id
           WHERE f.user_id = ? ORDER BY u.display_name COLLATE NOCASE""",
        (g.user["id"],),
    ).fetchall()
    return jsonify({"friends": [public_profile(row) for row in rows]})


@api.post("/friends")
@require_user
def add_friend():
    payload = request.get_json(silent=True) or {}
    friend_code = re.sub(r"\s+", "", str(payload.get("friend_code", ""))).upper()
    if not re.fullmatch(r"[A-HJ-NP-Z2-9]{8}", friend_code):
        return jsonify({"error": "Enter an 8-character friend code."}), 400
    connection = database()
    friend = connection.execute("SELECT * FROM users WHERE friend_code = ?", (friend_code,)).fetchone()
    if friend is None:
        return jsonify({"error": "We couldn't find that friend code."}), 404
    if friend["id"] == g.user["id"]:
        return jsonify({"error": "That is your own friend code."}), 400
    connection.executemany(
        "INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)",
        ((g.user["id"], friend["id"]), (friend["id"], g.user["id"])),
    )
    connection.commit()
    return jsonify({"friend": public_profile(friend)}), 201


@api.get("/messages")
@require_user
def get_messages():
    try:
        after = max(0, int(request.args.get("after", "0")))
    except ValueError:
        return jsonify({"error": "The message cursor must be an integer."}), 400
    rows = database().execute(
        """SELECT m.id, m.body, m.created_at, u.display_name AS sender_name,
                  u.pet_name AS sender_pet_name, u.pet_avatar AS sender_pet_avatar
           FROM messages m JOIN users u ON u.id = m.sender_id
           WHERE m.recipient_id = ? AND m.id > ? ORDER BY m.id LIMIT 100""",
        (g.user["id"], after),
    ).fetchall()
    return jsonify({"messages": [dict(row) for row in rows]})


@api.post("/messages")
@require_user
def send_message():
    payload = request.get_json(silent=True) or {}
    friend_code = re.sub(r"\s+", "", str(payload.get("friend_code", ""))).upper()
    body = str(payload.get("body", "")).strip()
    if not body or len(body) > 500:
        return jsonify({"error": "Messages must contain 1–500 characters."}), 400
    friend = database().execute(
        """SELECT u.* FROM users u JOIN friends f ON f.friend_id = u.id
           WHERE f.user_id = ? AND u.friend_code = ?""",
        (g.user["id"], friend_code),
    ).fetchone()
    if friend is None:
        return jsonify({"error": "Add this friend using their code before sending a message."}), 404
    cursor = database().execute(
        "INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)",
        (g.user["id"], friend["id"], body),
    )
    database().commit()
    return jsonify({"id": cursor.lastrowid, "sent": True}), 201
