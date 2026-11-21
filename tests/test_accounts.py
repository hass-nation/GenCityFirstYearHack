import os
import re
import tempfile
import unittest
from unittest.mock import patch

from app import create_app
from account_store import get_db


class AccountFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "DATABASE": os.path.join(self.temp_dir.name, "test.sqlite"),
            "MAIL_BACKEND": "console",
        })
        self.client = self.app.test_client()
        self.sent_mail = []
        self.mail_patch = patch("app.send_account_email", side_effect=lambda *args: self.sent_mail.append(args))
        self.mail_patch.start()
        self.addCleanup(self.mail_patch.stop)

    def tearDown(self):
        self.temp_dir.cleanup()

    def csrf_token(self, path):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        match = re.search(rb'name="csrf_token" value="([^"]+)"', response.data)
        self.assertIsNotNone(match, f"No CSRF token found on {path}")
        return match.group(1).decode()

    def post_token(self, path, data):
        csrf_path = "/account" if path == "/logout" else path
        return self.client.post(path, data={"csrf_token": self.csrf_token(csrf_path), **data})

    def signup(self, email="person@example.com", password="password-123"):
        return self.post_token("/signup", {
            "display_name": "Test Person", "email": email, "password": password,
        })

    def login(self, email="person@example.com", password="password-123"):
        return self.post_token("/login", {"email": email, "password": password})

    def latest_token(self, route):
        self.assertTrue(self.sent_mail, "Expected an account email to be sent")
        body = self.sent_mail[-1][2]
        match = re.search(r"/" + re.escape(route) + r"/([^\s]+)", body)
        self.assertIsNotNone(match, f"No {route} link in email body: {body}")
        return match.group(1)

    def verify_latest_email(self):
        token = self.latest_token("verify")
        path = f"/verify/{token}"
        response = self.post_token(path, {})
        self.assertEqual(response.status_code, 302)
        return token

    def create_account(self, email="person@example.com", password="password-123"):
        response = self.signup(email=email, password=password)
        self.assertEqual(response.status_code, 302)
        self.verify_latest_email()
        response = self.login(email=email, password=password)
        self.assertEqual(response.status_code, 302)

    def test_signup_requires_email_verification_then_login_logout(self):
        response = self.signup()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/login")
        blocked = self.login()
        self.assertEqual(blocked.status_code, 200)
        self.assertIn(b"Verify your email before signing in", blocked.data)

        self.verify_latest_email()
        self.assertEqual(self.login().status_code, 302)
        self.assertEqual(self.client.get("/account").status_code, 200)
        self.assertEqual(self.post_token("/logout", {}).status_code, 302)
        self.assertEqual(self.client.get("/account").headers["Location"], "/login")

    def test_wrong_password_and_duplicate_email(self):
        self.create_account()
        self.post_token("/logout", {})
        wrong = self.login(password="incorrect-password")
        self.assertEqual(wrong.status_code, 200)
        self.assertIn(b"Email or password is incorrect", wrong.data)

        response = self.signup(email="PERSON@example.com")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"already exists", response.data)

    def test_login_rate_limit_blocks_sixth_failure(self):
        self.create_account()
        self.post_token("/logout", {})
        for _ in range(5):
            self.assertEqual(self.login(password="bad-password").status_code, 200)
        blocked = self.login(password="password-123")
        self.assertEqual(blocked.status_code, 429)

    def test_post_without_csrf_returns_400(self):
        response = self.client.post("/signup", data={
            "display_name": "Test Person", "email": "person@example.com", "password": "password-123",
        })
        self.assertEqual(response.status_code, 400)

    def test_signed_out_routes_redirect_and_privacy_is_public(self):
        for path in ("/account", "/settings", "/data", "/account/export", "/account/delete"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 302)
                self.assertIn("/login", response.headers["Location"])
        privacy = self.client.get("/privacy")
        self.assertEqual(privacy.status_code, 200)
        for phrase in (b"What we collect", b"Why we use it", b"Where it is stored",
                       b"How long it is kept", b"Your controls"):
            self.assertIn(phrase, privacy.data)
        self.assertIn(b'href="/privacy"', privacy.data)

    def test_signed_in_navigation_marks_current_page(self):
        self.create_account()
        for path, label in (("/account", "Account"), ("/settings", "Settings"),
                            ("/data", "Data"), ("/privacy", "Privacy"),
                            ("/account/delete", "Data")):
            with self.subTest(path=path):
                page = self.client.get(path)
                self.assertEqual(page.status_code, 200)
                self.assertIn(b'aria-current="page"', page.data)
                self.assertIn(f'>{label}</a>'.encode(), page.data)

    def test_profile_edit_and_email_change_requires_verification(self):
        self.create_account()
        response = self.post_token("/account", {
            "display_name": "Updated Name", "email": "updated@example.com",
        })
        self.assertEqual(response.status_code, 302)
        page = self.client.get("/account")
        self.assertIn(b"Updated Name", page.data)
        self.assertIn(b"updated@example.com", page.data)
        self.assertIn(b"Your email is not verified yet", page.data)
        self.verify_latest_email()
        with self.app.app_context():
            user = get_db().execute("SELECT email_verified FROM users").fetchone()
            self.assertEqual(user["email_verified"], 1)

    def test_password_change_checks_current_length_match_and_difference(self):
        self.create_account()
        common = {"current_password": "password-123", "new_password": "new-password-456",
                  "confirm_password": "new-password-456"}
        for fields, expected in (
            ({**common, "current_password": "wrong-password"}, b"current password is incorrect"),
            ({**common, "new_password": "short", "confirm_password": "short"}, b"at least 8 characters"),
            ({**common, "confirm_password": "different-password"}, b"do not match"),
            ({**common, "new_password": "password-123", "confirm_password": "password-123"},
             b"differs from your current password"),
        ):
            response = self.post_token("/account", fields)
            self.assertIn(expected, response.data if response.status_code == 200 else self.client.get("/account").data)
        self.assertEqual(self.post_token("/account", common).status_code, 302)
        self.post_token("/logout", {})
        self.assertIn(b"Email or password is incorrect", self.login(password="password-123").data)
        self.assertEqual(self.login(password="new-password-456").status_code, 302)

    def test_password_reset_is_generic_one_time_and_updates_password(self):
        self.create_account()
        self.post_token("/logout", {})
        response = self.post_token("/password-reset", {"email": "missing@example.com"})
        self.assertEqual(response.status_code, 302)
        self.assertIn(b"If an account uses that email", self.client.get("/login").data)
        self.assertEqual(len(self.sent_mail), 1)  # only the signup verification email

        self.post_token("/password-reset", {"email": "person@example.com"})
        token = self.latest_token("password-reset")
        reset_path = f"/password-reset/{token}"
        bad = self.post_token(reset_path, {"password": "short", "confirm_password": "short"})
        self.assertIn(b"at least 8 characters", bad.data)
        ok = self.post_token(reset_path, {"password": "changed-password", "confirm_password": "changed-password"})
        self.assertEqual(ok.status_code, 302)
        self.assertEqual(self.login(password="changed-password").status_code, 302)
        self.post_token("/logout", {})
        self.assertEqual(self.client.get(reset_path).status_code, 400)

    def test_resend_and_reset_requests_are_rate_limited(self):
        self.signup()
        for _ in range(4):
            response = self.post_token("/resend-verification", {"email": "person@example.com"})
            self.assertEqual(response.status_code, 302)
        self.assertEqual(len(self.sent_mail), 4)  # signup plus three resend emails
        for _ in range(4):
            response = self.post_token("/password-reset", {"email": "person@example.com"})
            self.assertEqual(response.status_code, 302)
        self.assertEqual(len(self.sent_mail), 7)  # three password-reset emails also sent

    def test_settings_toggle_is_saved_and_reminders_are_not_sent(self):
        self.create_account()
        self.assertIn(b"does not send reminders yet", self.client.get("/settings").data)
        self.post_token("/settings", {"daily_reminders": "on"})
        with self.app.app_context():
            self.assertEqual(get_db().execute("SELECT daily_reminders FROM user_settings").fetchone()[0], 1)
        self.post_token("/settings", {})
        with self.app.app_context():
            self.assertEqual(get_db().execute("SELECT daily_reminders FROM user_settings").fetchone()[0], 0)

    def test_data_page_and_export_include_user_data_without_password_hash(self):
        self.create_account()
        with self.app.app_context():
            db = get_db()
            uid = db.execute("SELECT id FROM users").fetchone()[0]
            db.execute("INSERT INTO tasks (id,user_id,title,done,due_at,completed_at) VALUES (?,?,?,?,?,?)",
                       ("task-1", uid, "Read chapter", 1, "2026-11-22", "2026-11-21T12:00:00"))
            db.execute("INSERT INTO pets (user_id,name,hunger,happiness,energy,xp,level,avatar,room_theme) "
                       "VALUES (?,?,?,?,?,?,?,?,?)", (uid, "Pixel", 35, 70, 80, 12, 2, "cat", "forest"))
            db.commit()

        page = self.client.get("/data")
        self.assertIn(b"person@example.com", page.data)
        self.assertIn(b"Read chapter", page.data)
        self.assertIn(b"Completed:", page.data)
        self.assertIn(b"Pixel", page.data)
        self.assertNotIn(b"password_hash", page.data)
        self.assertNotIn(b"password-123", page.data)

        payload = self.client.get("/account/export").get_json()
        self.assertEqual(payload["account"]["email"], "person@example.com")
        self.assertEqual(payload["tasks"][0]["title"], "Read chapter")
        self.assertEqual(payload["pet"]["name"], "Pixel")
        self.assertNotIn("password_hash", str(payload))
        self.assertNotIn("password-123", str(payload))

    def test_deletion_requires_exact_delete_and_cascades_linked_data(self):
        self.create_account()
        with self.app.app_context():
            uid = get_db().execute("SELECT id FROM users").fetchone()[0]
            get_db().execute("INSERT INTO tasks (id,user_id,title) VALUES ('t1', ?, 'task')", (uid,))
            get_db().execute("INSERT INTO pets (user_id) VALUES (?)", (uid,))
            get_db().commit()
        for confirmation in ("delete", "DELETE "):
            self.assertEqual(self.post_token("/account/delete", {"confirmation": confirmation}).status_code, 200)
            with self.app.app_context():
                self.assertEqual(get_db().execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)
        self.assertEqual(self.post_token("/account/delete", {"confirmation": "DELETE"}).status_code, 302)
        with self.app.app_context():
            for table in ("users", "user_settings", "tasks", "pets", "email_verification_tokens",
                          "password_reset_tokens"):
                self.assertEqual(get_db().execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
