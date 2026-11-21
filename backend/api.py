"""Small SQLite-backed profile and friend messaging API for the demo."""

from __future__ import annotations

from functools import wraps
from datetime import date
import hashlib
import re
import secrets
import sqlite3
import time
from typing import Any
from uuid import uuid4

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

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
            CREATE TABLE IF NOT EXISTS parties (
                code TEXT PRIMARY KEY,
                host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ends_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS party_members (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                party_code TEXT NOT NULL REFERENCES parties(code) ON DELETE CASCADE,
                ready INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS party_members_by_code ON party_members(party_code);
            CREATE TABLE IF NOT EXISTS shared_screen_time (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                day TEXT NOT NULL,
                seconds INTEGER NOT NULL CHECK (seconds BETWEEN 0 AND 90000)
            );
            """
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        if "email" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN email TEXT")
        if "password_hash" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        connection.executescript("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE) WHERE email IS NOT NULL; CREATE TABLE IF NOT EXISTS signin_attempts (email TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);")
        g.database = connection
    return g.database


@api.teardown_app_request
def close_database(_error: BaseException | None) -> None:
    connection = g.pop("database", None)
    if connection is not None:
        connection.close()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def request_payload() -> dict[str, Any]:
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


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
    payload = request_payload()
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


@api.post("/auth/signup")
def signup():
    payload = request_payload()
    name = str(payload.get("display_name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not name or len(name) > 24 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return jsonify(error="Enter a name of 1-24 characters and a valid email."), 400
    if len(password) < 8 or len(password) > 256:
        return jsonify(error="Password must be at least 8 characters."), 400
    connection = database()
    if connection.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
        return jsonify(error="An account with that email already exists."), 409
    token = secrets.token_urlsafe(32)
    user_id = str(uuid4())
    connection.execute("INSERT INTO users (id, display_name, friend_code, token_hash, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)", (user_id, name, new_friend_code(connection), token_digest(token), email, generate_password_hash(password)))
    connection.commit()
    user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return jsonify(token=token, profile=public_profile(user)), 201


@api.post("/auth/signin")
def signin():
    payload = request_payload()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    connection = database()
    attempt = connection.execute("SELECT failures, locked_until FROM signin_attempts WHERE email = ?", (email,)).fetchone()
    now = int(time.time())
    if attempt and attempt["locked_until"] > now:
        return jsonify(error="Too many failed sign-in attempts. Try again in 15 minutes."), 429
    user = connection.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
    if user is None or not user["password_hash"] or not check_password_hash(user["password_hash"], password):
        failures = (attempt["failures"] if attempt and attempt["locked_until"] <= now else 0) + 1
        locked = now + 900 if failures >= 5 else 0
        connection.execute("INSERT INTO signin_attempts (email, failures, locked_until) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures, locked_until=excluded.locked_until", (email, failures, locked))
        connection.commit()
        return jsonify(error="Email or password is incorrect."), 401
    connection.execute("DELETE FROM signin_attempts WHERE email = ?", (email,))
    token = secrets.token_urlsafe(32)
    connection.execute("UPDATE users SET token_hash = ? WHERE id = ?", (token_digest(token), user["id"]))
    connection.commit()
    return jsonify(token=token, profile=public_profile(user))


@api.post("/auth/signout")
@require_user
def signout():
    connection = database()
    connection.execute("UPDATE users SET token_hash = ? WHERE id = ?", (token_digest(secrets.token_urlsafe(32)), g.user["id"]))
    connection.commit()
    return "", 204


@api.get("/me/export")
@require_user
def export_me():
    connection = database()
    user_id = g.user["id"]
    friends = connection.execute("SELECT u.display_name, u.friend_code, u.pet_name, u.pet_avatar, u.pet_theme FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=?", (user_id,)).fetchall()
    messages = connection.execute("SELECT sender_id, recipient_id, body, created_at FROM messages WHERE sender_id=? OR recipient_id=? ORDER BY id", (user_id, user_id)).fetchall()
    return jsonify(profile={**public_profile(g.user), "email": g.user["email"]}, friends=[dict(row) for row in friends], messages=[dict(row) for row in messages])


@api.delete("/me")
@require_user
def delete_me():
    connection = database()
    connection.execute("DELETE FROM users WHERE id = ?", (g.user["id"],))
    connection.commit()
    return "", 204


@api.get("/me")
@require_user
def get_me():
    sharing = database().execute("SELECT 1 FROM shared_screen_time WHERE user_id = ?", (g.user["id"],)).fetchone()
    return jsonify(profile={**public_profile(g.user), "share_screen_time": sharing is not None})


@api.route("/me/screen-time", methods=["PATCH", "POST"])
@require_user
def share_screen_time():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Send a screen-time preference or daily total."), 400
    connection = database()
    user_id = g.user["id"]
    if request.method == "PATCH":
        enabled = payload.get("enabled")
        if type(enabled) is not bool:
            return jsonify(error="Choose whether to share screen time."), 400
        if not enabled:
            with connection:
                connection.execute("DELETE FROM shared_screen_time WHERE user_id = ?", (user_id,))
            return jsonify(enabled=False)

    day, seconds = payload.get("day"), payload.get("seconds")
    try:
        valid_day = isinstance(day, str) and date.fromisoformat(day).isoformat() == day
    except ValueError:
        valid_day = False
    if not valid_day or type(seconds) is not int or not 0 <= seconds <= 90000:
        return jsonify(error="Send a valid date and total in seconds."), 400

    with connection:
        if request.method == "PATCH":
            connection.execute(
                """INSERT INTO shared_screen_time (user_id, day, seconds) VALUES (?, ?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET day=excluded.day, seconds=excluded.seconds""",
                (user_id, day, seconds),
            )
            return jsonify(enabled=True)
        updated = connection.execute("UPDATE shared_screen_time SET day = ?, seconds = ? WHERE user_id = ?", (day, seconds, user_id))
        return jsonify(enabled=bool(updated.rowcount))


@api.patch("/me/pet")
@require_user
def update_pet():
    payload = request_payload()
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
        """SELECT u.*, s.day AS screen_day, s.seconds AS screen_seconds
           FROM friends f JOIN users u ON u.id = f.friend_id
           LEFT JOIN shared_screen_time s ON s.user_id = u.id
           WHERE f.user_id = ? ORDER BY u.display_name COLLATE NOCASE""",
        (g.user["id"],),
    ).fetchall()
    return jsonify(friends=[{
        **public_profile(row),
        **({"screen_time": {"day": row["screen_day"], "seconds": row["screen_seconds"]}} if row["screen_day"] else {}),
    } for row in rows])


@api.post("/friends")
@require_user
def add_friend():
    payload = request_payload()
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
    payload = request_payload()
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
