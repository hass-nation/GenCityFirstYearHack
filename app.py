"""Flask entry point for the PC Pet account and privacy flows."""

import os
import sqlite3
from datetime import timedelta
from pathlib import Path

from flask import Flask, abort, flash, g, jsonify, redirect, render_template, request, session, url_for

from account_store import close_db, get_db, init_db


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", "local-development-key-change-me"),
        DATABASE=os.path.join(app.instance_path, "pcpet.sqlite"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
    )
    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()

    @app.before_request
    def load_user_and_check_csrf():
        user_id = session.get("user_id")
        g.user = get_db().execute(
            "SELECT id, email, display_name, created_at FROM users WHERE id = ?", (user_id,)
        ).fetchone() if user_id else None
        if request.method == "POST":
            submitted = request.form.get("csrf_token", "")
            if not submitted or submitted != session.get("csrf_token"):
                abort(400, "Invalid form token. Refresh the page and try again.")

    @app.context_processor
    def inject_csrf_token():
        def csrf_token():
            import secrets

            if "csrf_token" not in session:
                session["csrf_token"] = secrets.token_urlsafe(32)
            return session["csrf_token"]

        return {"csrf_token": csrf_token}

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
                from werkzeug.security import generate_password_hash

                db = get_db()
                try:
                    cur = db.execute(
                        "INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)",
                        (email, display_name, generate_password_hash(password)),
                    )
                    db.commit()
                except sqlite3.IntegrityError:
                    error = "An account with that email already exists."
                else:
                    session.clear()
                    session["user_id"] = cur.lastrowid
                    session.permanent = True
                    flash("Account created. Welcome to PC Pet!", "success")
                    return redirect(url_for("account"))
            flash(error, "error")
        return render_template("auth.html", mode="signup")

    @app.route("/login", methods=("GET", "POST"))
    def login():
        if g.user:
            return redirect(url_for("account"))
        if request.method == "POST":
            from werkzeug.security import check_password_hash

            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            user = get_db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if user is None or not check_password_hash(user["password_hash"], password):
                flash("Email or password is incorrect.", "error")
            else:
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
        db = get_db()
        settings = db.execute("SELECT * FROM user_settings WHERE user_id = ?", (g.user["id"],)).fetchone()
        if request.method == "POST":
            display_name = request.form.get("display_name", "").strip()
            email = request.form.get("email", "").strip().lower()
            reminders = 1 if request.form.get("daily_reminders") == "on" else 0
            error = None
            if not display_name or len(display_name) > 60:
                error = "Enter a name between 1 and 60 characters."
            elif "@" not in email or len(email) > 254:
                error = "Enter a valid email address."
            if error:
                flash(error, "error")
            else:
                try:
                    db.execute("UPDATE users SET display_name = ?, email = ? WHERE id = ?",
                               (display_name, email, g.user["id"]))
                    db.execute("UPDATE user_settings SET daily_reminders = ? WHERE user_id = ?",
                               (reminders, g.user["id"]))
                    db.commit()
                except sqlite3.IntegrityError:
                    db.rollback()
                    flash("That email is already used by another account.", "error")
                else:
                    flash("Your profile and settings have been saved.", "success")
                    return redirect(url_for("account"))
            settings = {"daily_reminders": reminders}
        return render_template("account.html", user=g.user, settings=settings)

    @app.get("/account/export")
    def export_data():
        if not g.user:
            return redirect(url_for("login"))
        settings = get_db().execute("SELECT daily_reminders FROM user_settings WHERE user_id = ?",
                                    (g.user["id"],)).fetchone()
        response = jsonify({
            "profile": {"email": g.user["email"], "display_name": g.user["display_name"],
                        "created_at": g.user["created_at"]},
            "settings": {"daily_reminders": bool(settings["daily_reminders"])},
        })
        response.headers["Content-Disposition"] = "attachment; filename=pc-pet-account-data.json"
        return response

    @app.route("/account/delete", methods=("GET", "POST"))
    def delete_account():
        if not g.user:
            return redirect(url_for("login"))
        if request.method == "POST":
            if request.form.get("confirmation", "") != "DELETE":
                flash("Type DELETE to confirm account removal.", "error")
            else:
                get_db().execute("DELETE FROM users WHERE id = ?", (g.user["id"],))
                get_db().commit()
                session.clear()
                flash("Your account and saved account settings have been deleted.", "success")
                return redirect(url_for("login"))
        return render_template("delete_account.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
