"""SQLite storage and schema migrations for PC Pet account-owned data."""

import sqlite3

from flask import current_app, g


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _columns(db, table_name):
    return {row["name"] for row in db.execute(f"PRAGMA table_info({table_name})")}


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            email_verified INTEGER NOT NULL DEFAULT 1 CHECK (email_verified IN (0, 1))
        );
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            daily_reminders INTEGER NOT NULL DEFAULT 1 CHECK (daily_reminders IN (0, 1))
        );
        CREATE TRIGGER IF NOT EXISTS create_default_settings
        AFTER INSERT ON users
        BEGIN
            INSERT INTO user_settings (user_id) VALUES (NEW.id);
        END;
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_hash TEXT NOT NULL,
            attempted_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS login_attempts_subject_time
            ON login_attempts (subject_hash, attempted_at);
        CREATE TABLE IF NOT EXISTS account_email_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_hash TEXT NOT NULL,
            requested_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS account_email_requests_hash_time
            ON account_email_requests (request_hash, requested_at);
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
            due_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS tasks_by_user ON tasks (user_id, due_at);
        CREATE TABLE IF NOT EXISTS pets (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT 'Pixel',
            hunger INTEGER NOT NULL DEFAULT 35 CHECK (hunger BETWEEN 0 AND 100),
            happiness INTEGER NOT NULL DEFAULT 70 CHECK (happiness BETWEEN 0 AND 100),
            energy INTEGER NOT NULL DEFAULT 80 CHECK (energy BETWEEN 0 AND 100),
            xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
            level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
            avatar TEXT,
            room_theme TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Preserve old accounts as verified when adding the column to an existing DB.
    if "email_verified" not in _columns(db, "users"):
        db.execute(
            "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1 "
            "CHECK (email_verified IN (0, 1))"
        )
    db.commit()
