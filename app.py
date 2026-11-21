"""Flask entry point for PC Pet account, privacy, and data-management flows."""

import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from datetime import timedelta

from flask import Flask, abort, current_app, flash, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from account_mail import send_account_email
from account_store import close_db, get_db, init_db


EMAIL_VERIFY_TTL = 24 * 60 * 60
PASSWORD_RESET_TTL = 60 * 60
EMAIL_REQUEST_LIMIT = 3
EMAIL_REQUEST_WINDOW = 60 * 60


def _token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _email_url(endpoint, token):
    base = current_app.config["PUBLIC_BASE_URL"] or request.url_root.rstrip("/")
    return f"{base}{url_for(endpoint, token=token)}"


def _issue_email_token(table, user_id, ttl_seconds):
    if table not in {"email_verification_tokens", "password_reset_tokens"}:
        raise ValueError("Unsupported token table.")
    token = secrets.token_urlsafe(32)
    db = get_db()
    db.execute(
        f"INSERT INTO {table} (user_id, token_hash, expires_at) VALUES (?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at",
        (user_id, _token_hash(token), int(time.time()) + ttl_seconds),
    )
    db.commit()
    return token


def _valid_token_user(table, token):
    if table not in {"email_verification_tokens", "password_reset_tokens"}:
        raise ValueError("Unsupported token table.")
    return get_db().execute(
        f"SELECT users.id, users.email, users.display_name, users.email_verified "
        f"FROM {table} JOIN users ON users.id = {table}.user_id "
        f"WHERE {table}.token_hash = ? AND {table}.expires_at >= ?",
        (_token_hash(token), int(time.time())),
    ).fetchone()


def _send_verification_email(user):
    token = _issue_email_token("email_verification_tokens", user["id"], EMAIL_VERIFY_TTL)
    link = _email_url("verify_email", token)
    send_account_email(
        user["email"],
        "Verify your PC Pet email",
        f"Hi {user['display_name']},\n\nVerify your email address using this link (valid for 24 hours):\n{link}\n",
    )


def _send_password_reset_email(user):
    token = _issue_email_token("password_reset_tokens", user["id"], PASSWORD_RESET_TTL)
    link = _email_url("reset_password", token)
    send_account_email(
        user["email"],
        "Reset your PC Pet password",
        f"Use this link to choose a new password (valid for 1 hour):\n{link}\n",
    )


def _login_subject_hash(email, remote_addr):
    secret = str(current_app.config["SECRET_KEY"]).encode("utf-8")
    subject = f"{email}\0{remote_addr or 'unknown'}".encode("utf-8")
    return hmac.new(secret, subject, hashlib.sha256).hexdigest()


def _email_request_hash(action, email, remote_addr):
    secret = str(current_app.config["SECRET_KEY"]).encode("utf-8")
    subject = f"{action}\0{email}\0{remote_addr or 'unknown'}".encode("utf-8")
    return hmac.new(secret, subject, hashlib.sha256).hexdigest()


def _allow_email_request(action, email, remote_addr):
    db = get_db()
    now = int(time.time())
    db.execute("DELETE FROM account_email_requests WHERE requested_at < ?", (now - 24 * 60 * 60,))
    request_hash = _email_request_hash(action, email, remote_addr)
    count = db.execute(
        "SELECT COUNT(*) FROM account_email_requests WHERE request_hash = ? AND requested_at >= ?",
        (request_hash, now - EMAIL_REQUEST_WINDOW),
    ).fetchone()[0]
    if count >= EMAIL_REQUEST_LIMIT:
        db.commit()
        return False
    db.execute(
        "INSERT INTO account_email_requests (request_hash, requested_at) VALUES (?, ?)",
        (request_hash, now),
    )
    db.commit()
    return True


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app_env = os.environ.get("APP_ENV", "development").lower()
    configured_secret = os.environ.get("FLASK_SECRET_KEY")
    app.config.from_mapping(
        APP_ENV=app_env,
        SECRET_KEY=configured_secret or secrets.token_urlsafe(48),
        DATABASE=os.path.join(app.instance_path, "pcpet.sqlite"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=(os.environ.get("COOKIE_SECURE", "0") == "1" or app_env == "production"),
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
        MAIL_BACKEND=os.environ.get("MAIL_BACKEND", "console").lower(),
        MAIL_HOST=os.environ.get("MAIL_HOST", ""),
        MAIL_PORT=int(os.environ.get("MAIL_PORT", "587")),
        MAIL_USERNAME=os.environ.get("MAIL_USERNAME", ""),
        MAIL_PASSWORD=os.environ.get("MAIL_PASSWORD", ""),
        MAIL_FROM=os.environ.get("MAIL_FROM", ""),
        MAIL_USE_TLS=os.environ.get("MAIL_USE_TLS", "1") != "0",
        PUBLIC_BASE_URL=os.environ.get("PUBLIC_BASE_URL", "").rstrip("/"),
        LOGIN_MAX_FAILURES=5,
        LOGIN_WINDOW_SECONDS=15 * 60,
    )
    if test_config:
        app.config.update(test_config)
    if app.config["APP_ENV"] == "production":
        if not configured_secret and not (test_config and test_config.get("SECRET_KEY")):
            raise RuntimeError("Set FLASK_SECRET_KEY before starting PC Pet in production.")
        if app.config["MAIL_BACKEND"] != "smtp" or not app.config["MAIL_HOST"] or not app.config["MAIL_FROM"]:
            raise RuntimeError("Production requires SMTP settings for account verification and password reset.")
        if not app.config["PUBLIC_BASE_URL"].startswith("https://"):
            raise RuntimeError("Set PUBLIC_BASE_URL to the HTTPS address of the production app.")

    if not configured_secret and app.config["APP_ENV"] != "production":
        app.logger.warning("FLASK_SECRET_KEY is unset; using a temporary development secret for this run.")

    os.makedirs(app.instance_path, exist_ok=True)
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()

    @app.before_request
    def load_user_and_check_csrf():
        db = get_db()
        now = int(time.time())
        db.execute("DELETE FROM email_verification_tokens WHERE expires_at < ?", (now,))
        db.execute("DELETE FROM password_reset_tokens WHERE expires_at < ?", (now,))
        db.execute("DELETE FROM login_attempts WHERE attempted_at < ?", (now - 24 * 60 * 60,))
        db.execute("DELETE FROM account_email_requests WHERE requested_at < ?", (now - 24 * 60 * 60,))
        db.commit()
        user_id = session.get("user_id")
        g.user = (
            get_db().execute(
                "SELECT id, email, display_name, created_at, email_verified FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if user_id
            else None
        )
        if request.method == "POST":
            submitted = request.form.get("csrf_token", "")
            if not submitted or submitted != session.get("csrf_token"):
                abort(400, "Invalid form token. Refresh the page and try again.")

    @app.context_processor
    def inject_csrf_token():
        def csrf_token():
            if "csrf_token" not in session:
                session["csrf_token"] = secrets.token_urlsafe(32)
            return session["csrf_token"]

        return {"csrf_token": csrf_token}

    @app.context_processor
    def inject_account_navigation():
        return {
            "account_navigation": (
                ("account", "Account", "account"),
                ("settings", "Settings", "settings"),
                ("data", "Data", "data"),
                ("privacy", "Privacy", "privacy"),
            )
        }

    @app.get("/")
    def home():
        return redirect(url_for("account")) if g.user else redirect(url_for("login"))

    @app.route("/signup", methods=("GET", "POST"))
    def signup():
        if g.user:
            return redirect(url_for("account"))
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            display_name = request.form.get("display_name", "").strip()
            password = request.form.get("password", "")
            error = None
            if not display_name or len(display_name) > 60:
                error = "Enter a name between 1 and 60 characters."
            elif "@" not in email or len(email) > 254:
                error = "Enter a valid email address."
            elif len(password) < 8:
                error = "Use a password with at least 8 characters."

            if error is None:
                db = get_db()
                try:
                    cur = db.execute(
                        "INSERT INTO users (email, display_name, password_hash, email_verified) "
                        "VALUES (?, ?, ?, 0)",
                        (email, display_name, generate_password_hash(password)),
                    )
                    db.commit()
                except sqlite3.IntegrityError:
                    error = "An account with that email already exists."
                else:
                    user = db.execute("SELECT id, email, display_name FROM users WHERE id = ?",
                                      (cur.lastrowid,)).fetchone()
                    try:
                        _send_verification_email(user)
                    except (OSError, RuntimeError, ValueError) as exc:
                        current_app.logger.warning("Could not send verification email: %s", exc)
                        flash("Account created. Email delivery failed; use the resend verification page later.", "error")
                    else:
                        flash("Account created. Check your email for a verification link.", "success")
                    return redirect(url_for("login"))
            flash(error, "error")
        return render_template("auth.html", mode="signup")

    @app.route("/login", methods=("GET", "POST"))
    def login():
        if g.user:
            return redirect(url_for("account"))
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            subject_hash = _login_subject_hash(email, request.remote_addr)
            db = get_db()
            now = int(time.time())
            db.execute("DELETE FROM login_attempts WHERE attempted_at < ?", (now - 24 * 60 * 60,))
            attempts = db.execute(
                "SELECT COUNT(*) FROM login_attempts WHERE subject_hash = ? AND attempted_at >= ?",
                (subject_hash, now - current_app.config["LOGIN_WINDOW_SECONDS"]),
            ).fetchone()[0]
            if attempts >= current_app.config["LOGIN_MAX_FAILURES"]:
                db.commit()
                flash("Too many sign-in attempts. Try again in 15 minutes.", "error")
                return render_template("auth.html", mode="login"), 429

            user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if user is None or not check_password_hash(user["password_hash"], password):
                db.execute(
                    "INSERT INTO login_attempts (subject_hash, attempted_at) VALUES (?, ?)",
                    (subject_hash, now),
                )
                db.commit()
                flash("Email or password is incorrect.", "error")
            elif not user["email_verified"]:
                db.commit()
                flash("Verify your email before signing in. You can request another link below.", "error")
            else:
                db.execute("DELETE FROM login_attempts WHERE subject_hash = ?", (subject_hash,))
                db.commit()
                session.clear()
                session["user_id"] = user["id"]
                session.permanent = True
                flash("You are signed in.", "success")
                return redirect(url_for("account"))
        return render_template("auth.html", mode="login")

    @app.post("/logout")
    def logout():
        session.clear()
        flash("You are signed out.", "success")
        return redirect(url_for("login"))

    @app.route("/account", methods=("GET", "POST"))
    def account():
        if not g.user:
            return redirect(url_for("login"))
        if request.method == "POST":
            if "current_password" in request.form:
                return change_password()

            display_name = request.form.get("display_name", "").strip()
            email = request.form.get("email", "").strip().lower()
            error = None
            if not display_name or len(display_name) > 60:
                error = "Enter a name between 1 and 60 characters."
            elif "@" not in email or len(email) > 254:
                error = "Enter a valid email address."
            if error:
                flash(error, "error")
            else:
                email_changed = email != g.user["email"]
                db = get_db()
                try:
                    db.execute(
                        "UPDATE users SET display_name = ?, email = ?, "
                        "email_verified = CASE WHEN ? THEN 0 ELSE email_verified END WHERE id = ?",
                        (display_name, email, int(email_changed), g.user["id"]),
                    )
                    db.commit()
                except sqlite3.IntegrityError:
                    db.rollback()
                    flash("That email is already used by another account.", "error")
                else:
                    if email_changed:
                        user = db.execute("SELECT id, email, display_name FROM users WHERE id = ?",
                                          (g.user["id"],)).fetchone()
                        try:
                            _send_verification_email(user)
                        except (OSError, RuntimeError, ValueError) as exc:
                            current_app.logger.warning("Could not send verification email: %s", exc)
                            flash("Email updated. Verification email could not be sent; request another link later.", "error")
                        else:
                            flash("Email updated. Verify the new address to use it for future sign-ins.", "success")
                    else:
                        flash("Your account details have been saved.", "success")
                    return redirect(url_for("account"))
        user = get_db().execute(
            "SELECT id, email, display_name, created_at, email_verified FROM users WHERE id = ?",
            (g.user["id"],),
        ).fetchone()
        return render_template("account.html", user=user)

    def change_password():
        current_password = request.form.get("current_password", "")
        new_password = request.form.get("new_password", "")
        confirmation = request.form.get("confirm_password", "")
        stored = get_db().execute(
            "SELECT password_hash FROM users WHERE id = ?", (g.user["id"],)
        ).fetchone()

        if not check_password_hash(stored["password_hash"], current_password):
            flash("Your current password is incorrect.", "error")
        elif len(new_password) < 8:
            flash("Use a new password with at least 8 characters.", "error")
        elif new_password != confirmation:
            flash("The new password and confirmation do not match.", "error")
        elif check_password_hash(stored["password_hash"], new_password):
            flash("Choose a new password that differs from your current password.", "error")
        else:
            db = get_db()
            db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (generate_password_hash(new_password), g.user["id"]),
            )
            db.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (g.user["id"],))
            db.commit()
            flash("Your password has been changed.", "success")
        return redirect(url_for("account"))

    @app.route("/settings", methods=("GET", "POST"))
    def settings():
        if not g.user:
            return redirect(url_for("login"))
        db = get_db()
        if request.method == "POST":
            reminders = 1 if request.form.get("daily_reminders") == "on" else 0
            db.execute(
                "UPDATE user_settings SET daily_reminders = ? WHERE user_id = ?",
                (reminders, g.user["id"]),
            )
            db.commit()
            flash("Your reminder preference has been saved. Reminders are not sent yet.", "success")
            return redirect(url_for("settings"))
        preferences = db.execute(
            "SELECT user_id, daily_reminders FROM user_settings WHERE user_id = ?", (g.user["id"],)
        ).fetchone()
        return render_template("settings.html", preferences=preferences)

    @app.get("/data")
    def data():
        if not g.user:
            return redirect(url_for("login"))
        db = get_db()
        account_record = db.execute(
            "SELECT id, email, display_name, created_at, email_verified FROM users WHERE id = ?",
            (g.user["id"],),
        ).fetchone()
        settings_record = db.execute(
            "SELECT user_id, daily_reminders FROM user_settings WHERE user_id = ?", (g.user["id"],)
        ).fetchone()
        tasks = db.execute(
            "SELECT id, user_id, title, done, due_at, completed_at, created_at "
            "FROM tasks WHERE user_id = ? ORDER BY created_at, id", (g.user["id"],)
        ).fetchall()
        pet = db.execute(
            "SELECT user_id, name, hunger, happiness, energy, xp, level, avatar, room_theme, updated_at "
            "FROM pets WHERE user_id = ?", (g.user["id"],)
        ).fetchone()
        return render_template("data.html", account_record=account_record,
                               settings_record=settings_record, tasks=tasks, pet=pet)

    @app.get("/privacy")
    def privacy():
        return render_template("privacy.html")

    @app.route("/verify/<token>", methods=("GET", "POST"))
    def verify_email(token):
        user = _valid_token_user("email_verification_tokens", token)
        if not user or user["email_verified"]:
            flash("That verification link is invalid or expired. Request a new one.", "error")
            return redirect(url_for("resend_verification"))
        if request.method == "POST":
            db = get_db()
            db.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user["id"],))
            db.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", (user["id"],))
            db.commit()
            flash("Email verified. You can now sign in.", "success")
            return redirect(url_for("login"))
        return render_template("verify_email.html", token=token)

    @app.route("/resend-verification", methods=("GET", "POST"))
    def resend_verification():
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            allowed = _allow_email_request("verification", email, request.remote_addr)
            user = get_db().execute(
                "SELECT id, email, display_name, email_verified FROM users WHERE email = ?", (email,)
            ).fetchone() if allowed else None
            if allowed and user and not user["email_verified"]:
                try:
                    _send_verification_email(user)
                except (OSError, RuntimeError, ValueError) as exc:
                    current_app.logger.warning("Could not send verification email: %s", exc)
            flash("If an unverified account uses that email, a verification link has been sent.", "success")
            return redirect(url_for("login"))
        return render_template("email_action.html", mode="verification")

    @app.route("/password-reset", methods=("GET", "POST"))
    def request_password_reset():
        if request.method == "POST":
            email = request.form.get("email", "").strip().lower()
            allowed = _allow_email_request("password_reset", email, request.remote_addr)
            user = get_db().execute(
                "SELECT id, email, display_name FROM users WHERE email = ?", (email,)
            ).fetchone() if allowed else None
            if allowed and user:
                try:
                    _send_password_reset_email(user)
                except (OSError, RuntimeError, ValueError) as exc:
                    current_app.logger.warning("Could not send password reset email: %s", exc)
            flash("If an account uses that email, a password-reset link has been sent.", "success")
            return redirect(url_for("login"))
        return render_template("email_action.html", mode="password_reset")

    @app.route("/password-reset/<token>", methods=("GET", "POST"))
    def reset_password(token):
        user = _valid_token_user("password_reset_tokens", token)
        if not user:
            return render_template("reset_password.html", token=token, invalid=True), 400
        if request.method == "POST":
            password = request.form.get("password", "")
            confirmation = request.form.get("confirm_password", "")
            if len(password) < 8:
                flash("Use a password with at least 8 characters.", "error")
            elif password != confirmation:
                flash("The new password and confirmation do not match.", "error")
            else:
                db = get_db()
                db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                           (generate_password_hash(password), user["id"]))
                db.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user["id"],))
                db.commit()
                flash("Password updated. Sign in with your new password.", "success")
                return redirect(url_for("login"))
        return render_template("reset_password.html", token=token, invalid=False)

    @app.get("/account/export")
    def export_data():
        if not g.user:
            return redirect(url_for("login"))
        db = get_db()
        account_record = db.execute(
            "SELECT id, email, display_name, created_at, email_verified FROM users WHERE id = ?",
            (g.user["id"],),
        ).fetchone()
        settings_record = db.execute(
            "SELECT user_id, daily_reminders FROM user_settings WHERE user_id = ?", (g.user["id"],)
        ).fetchone()
        tasks = db.execute(
            "SELECT id, user_id, title, done, due_at, completed_at, created_at "
            "FROM tasks WHERE user_id = ? ORDER BY created_at, id", (g.user["id"],)
        ).fetchall()
        pet = db.execute(
            "SELECT user_id, name, hunger, happiness, energy, xp, level, avatar, room_theme, updated_at "
            "FROM pets WHERE user_id = ?", (g.user["id"],)
        ).fetchone()
        response = jsonify({
            "account": dict(account_record),
            "settings": {"user_id": settings_record["user_id"],
                         "daily_reminders": bool(settings_record["daily_reminders"])},
            "tasks": [dict(task) for task in tasks],
            "pet": dict(pet) if pet else None,
        })
        response.headers["Content-Disposition"] = "attachment; filename=pc-pet-data.json"
        return response

    @app.route("/account/delete", methods=("GET", "POST"))
    def delete_account():
        if not g.user:
            return redirect(url_for("login"))
        if request.method == "POST":
            if request.form.get("confirmation", "") != "DELETE":
                flash("Type DELETE to confirm account removal.", "error")
            else:
                subject_hash = _login_subject_hash(g.user["email"], request.remote_addr)
                db = get_db()
                db.execute("DELETE FROM users WHERE id = ?", (g.user["id"],))
                db.execute("DELETE FROM login_attempts WHERE subject_hash = ?", (subject_hash,))
                db.commit()
                session.clear()
                flash("Your account and all data linked to it have been deleted.", "success")
                return redirect(url_for("login"))
        return render_template("delete_account.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
