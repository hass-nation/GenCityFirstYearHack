import os
import re
import tempfile
import unittest

from app import create_app
from account_store import get_db


class AccountFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = os.path.join(self.temp_dir.name, "test.sqlite")
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "DATABASE": database,
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def csrf_token(self, path):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        match = re.search(rb'name="csrf_token" value="([^"]+)"', response.data)
        self.assertIsNotNone(match, f"No CSRF token found on {path}")
        return match.group(1).decode()

    def signup(self, email="person@example.com", password="password-123"):
        token = self.csrf_token("/signup")
        return self.client.post("/signup", data={
            "csrf_token": token,
            "display_name": "Test Person",
            "email": email,
            "password": password,
        })

    def login(self, email="person@example.com", password="password-123"):
        token = self.csrf_token("/login")
        return self.client.post("/login", data={
            "csrf_token": token,
            "email": email,
            "password": password,
        })

    def post_token(self, path, data):
        payload = {"csrf_token": self.csrf_token(path), **data}
        return self.client.post(path, data=payload)

    def create_account(self):
        response = self.signup()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/account")

    def test_signup_login_logout_and_wrong_password(self):
        response = self.signup()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/account")
        self.assertEqual(self.client.get("/account").status_code, 200)

        logout_token = self.csrf_token("/account")
        self.assertEqual(self.client.post("/logout", data={"csrf_token": logout_token}).status_code, 302)

        wrong = self.login(password="incorrect-password")
        self.assertEqual(wrong.status_code, 200)
        self.assertIn(b"Email or password is incorrect", wrong.data)

        valid = self.login()
        self.assertEqual(valid.status_code, 302)
        self.assertEqual(self.client.get("/account").status_code, 200)

        token = self.csrf_token("/account")
        signed_out = self.client.post("/logout", data={"csrf_token": token})
        self.assertEqual(signed_out.status_code, 302)
        self.assertEqual(signed_out.headers["Location"], "/login")

    def test_duplicate_email_is_rejected_case_insensitively(self):
        self.create_account()
        token = self.csrf_token("/account")
        self.client.post("/logout", data={"csrf_token": token})
        response = self.signup(email="PERSON@example.com")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"already exists", response.data)

    def test_post_without_csrf_returns_400(self):
        response = self.client.post("/signup", data={
            "display_name": "Test Person",
            "email": "person@example.com",
            "password": "password-123",
        })
        self.assertEqual(response.status_code, 400)

    def test_signed_out_account_routes_redirect_and_privacy_is_public(self):
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

    def test_signed_in_navigation_highlights_current_page(self):
        self.create_account()
        for path, current in (("/account", "Account"), ("/settings", "Settings"),
                              ("/data", "Data"), ("/privacy", "Privacy"),
                              ("/account/delete", "Data")):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b'aria-current="page"', response.data)
                self.assertIn(f'>{current}</a>'.encode(), response.data)

    def test_profile_can_be_edited(self):
        self.create_account()
        response = self.post_token("/account", {
            "display_name": "Updated Name",
            "email": "updated@example.com",
        })
        self.assertEqual(response.status_code, 302)
        page = self.client.get("/account")
        self.assertIn(b"Updated Name", page.data)
        self.assertIn(b"updated@example.com", page.data)

    def test_password_change_checks_current_length_match_and_difference(self):
        self.create_account()
        token = self.csrf_token("/account")
        common = {"current_password": "password-123", "new_password": "new-password-456",
                  "confirm_password": "new-password-456"}

        invalid_inputs = (
            ({**common, "current_password": "wrong-password"}, b"current password is incorrect"),
            ({**common, "new_password": "short", "confirm_password": "short"}, b"at least 8 characters"),
            ({**common, "confirm_password": "different-password"}, b"do not match"),
            ({**common, "new_password": "password-123", "confirm_password": "password-123"},
             b"differs from your current password"),
        )
        for fields, expected_message in invalid_inputs:
            with self.subTest(message=expected_message):
                response = self.client.post("/account", data={"csrf_token": token, **fields},
                                            follow_redirects=True)
                self.assertIn(expected_message, response.data)

        accepted = self.client.post("/account", data={"csrf_token": token, **common})
        self.assertEqual(accepted.status_code, 302)
        logout_token = self.csrf_token("/account")
        self.client.post("/logout", data={"csrf_token": logout_token})
        self.assertIn(b"Email or password is incorrect", self.login(password="password-123").data)
        self.assertEqual(self.login(password="new-password-456").status_code, 302)

    def test_settings_toggle_is_saved_and_notice_says_not_sent(self):
        self.create_account()
        page = self.client.get("/settings")
        self.assertIn(b"does not send reminders yet", page.data)
        response = self.post_token("/settings", {"daily_reminders": "on"})
        self.assertEqual(response.status_code, 302)
        with self.app.app_context():
            setting = get_db().execute("SELECT daily_reminders FROM user_settings").fetchone()
            self.assertEqual(setting["daily_reminders"], 1)

        self.post_token("/settings", {})
        with self.app.app_context():
            setting = get_db().execute("SELECT daily_reminders FROM user_settings").fetchone()
            self.assertEqual(setting["daily_reminders"], 0)

    def test_data_page_and_export_exclude_password_hash(self):
        self.create_account()
        page = self.client.get("/data")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"person@example.com", page.data)
        self.assertNotIn(b"password_hash", page.data)
        self.assertNotIn(b"password-123", page.data)

        exported = self.client.get("/account/export")
        self.assertEqual(exported.status_code, 200)
        payload = exported.get_json()
        self.assertEqual(payload["account"]["email"], "person@example.com")
        self.assertIn("daily_reminders", payload["settings"])
        self.assertNotIn("password_hash", str(payload))
        self.assertNotIn("password-123", str(payload))

    def test_deletion_requires_exact_delete(self):
        self.create_account()
        for confirmation in ("delete", "DELETE "):
            response = self.post_token("/account/delete", {"confirmation": confirmation},)
            self.assertEqual(response.status_code, 200)
            with self.app.app_context():
                self.assertEqual(get_db().execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)

        response = self.post_token("/account/delete", {"confirmation": "DELETE"})
        self.assertEqual(response.status_code, 302)
        with self.app.app_context():
            self.assertEqual(get_db().execute("SELECT COUNT(*) FROM users").fetchone()[0], 0)
            self.assertEqual(get_db().execute("SELECT COUNT(*) FROM user_settings").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
