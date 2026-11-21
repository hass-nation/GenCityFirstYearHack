import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import create_app


class ApiAccountTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.app = create_app()
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-only-secret",
            DATABASE=str(self.database_path),
            CORS_ORIGINS="https://hass-nation.github.io",
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def signup(self, email="one@example.com", display_name="One", password="correct horse"):
        return self.client.post("/api/auth/signup", json={
            "email": email,
            "display_name": display_name,
            "password": password,
        })

    @staticmethod
    def auth(token):
        return {"Authorization": f"Bearer {token}"}

    def test_email_signup_and_signin_share_the_profile_token_format(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        created = response.get_json()
        self.assertTrue(created["token"])
        self.assertEqual(created["profile"]["display_name"], "One")

        signed_in = self.client.post("/api/auth/signin", json={
            "email": "ONE@example.com",
            "password": "correct horse",
        })
        self.assertEqual(signed_in.status_code, 200)
        data = signed_in.get_json()
        self.assertTrue(data["token"])
        self.assertEqual(data["profile"]["id"], created["profile"]["id"])
        self.assertEqual(self.client.get("/api/me", headers=self.auth(data["token"])).status_code, 200)

    def test_wrong_password_is_generic_and_duplicate_email_is_case_insensitive(self):
        self.assertEqual(self.signup().status_code, 201)
        duplicate = self.signup(email="ONE@example.com")
        self.assertEqual(duplicate.status_code, 409)
        wrong = self.client.post("/api/auth/signin", json={"email": "one@example.com", "password": "incorrect"})
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.get_json()["error"], "Email or password is incorrect.")

    def test_signup_uses_name_email_and_password_validation(self):
        invalid = [
            ({"email": "not-an-email", "display_name": "One", "password": "password123"}, 400),
            ({"email": "one@example.com", "display_name": "", "password": "password123"}, 400),
            ({"email": "one@example.com", "display_name": "One", "password": "short"}, 400),
        ]
        for payload, expected_status in invalid:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/auth/signup", json=payload).status_code, expected_status)

    def test_signout_revokes_the_current_bearer_token(self):
        created = self.signup().get_json()
        signed_out = self.client.post("/api/auth/signout", headers=self.auth(created["token"]))
        self.assertEqual(signed_out.status_code, 204)
        self.assertEqual(self.client.get("/api/me", headers=self.auth(created["token"])).status_code, 401)

    def test_failed_signins_are_rate_limited(self):
        self.assertEqual(self.signup().status_code, 201)
        for _ in range(4):
            response = self.client.post("/api/auth/signin", json={"email": "one@example.com", "password": "wrong"})
            self.assertEqual(response.status_code, 401)
        locked = self.client.post("/api/auth/signin", json={"email": "one@example.com", "password": "wrong"})
        self.assertEqual(locked.status_code, 429)
        blocked = self.client.post("/api/auth/signin", json={"email": "one@example.com", "password": "correct horse"})
        self.assertEqual(blocked.status_code, 429)

    def test_export_includes_account_data_but_no_password_or_token_hash(self):
        first = self.signup().get_json()
        second = self.signup(email="two@example.com", display_name="Two").get_json()
        joined = self.client.post("/api/friends", json={"friend_code": second["profile"]["friend_code"]}, headers=self.auth(first["token"]))
        self.assertEqual(joined.status_code, 201)
        sent = self.client.post("/api/messages", json={"friend_code": second["profile"]["friend_code"], "body": "Good luck!"}, headers=self.auth(first["token"]))
        self.assertEqual(sent.status_code, 201)

        exported = self.client.get("/api/me/export", headers=self.auth(first["token"]))
        self.assertEqual(exported.status_code, 200)
        data = exported.get_json()
        self.assertEqual(data["profile"]["email"], "one@example.com")
        self.assertEqual(data["pet"]["name"], "Biscuit")
        self.assertEqual(len(data["friends"]), 1)
        self.assertEqual(data["messages"][0]["body"], "Good luck!")
        serialized = str(data).lower()
        self.assertNotIn("password_hash", serialized)
        self.assertNotIn("token_hash", serialized)
        self.assertNotIn(first["token"], serialized)

    def test_delete_removes_profile_and_cascades_friends_and_messages(self):
        first = self.signup().get_json()
        second = self.signup(email="two@example.com", display_name="Two").get_json()
        self.client.post("/api/friends", json={"friend_code": second["profile"]["friend_code"]}, headers=self.auth(first["token"]))
        self.client.post("/api/messages", json={"friend_code": second["profile"]["friend_code"], "body": "Hi"}, headers=self.auth(first["token"]))

        deleted = self.client.delete("/api/me", headers=self.auth(first["token"]))
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/me", headers=self.auth(first["token"])).status_code, 401)
        self.assertEqual(self.client.get("/api/friends", headers=self.auth(second["token"])).get_json()["friends"], [])
        self.assertEqual(self.client.get("/api/messages", headers=self.auth(second["token"])).get_json()["messages"], [])

    def test_legacy_user_table_is_migrated_without_losing_profile(self):
        connection = sqlite3.connect(self.database_path)
        connection.executescript("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                friend_code TEXT NOT NULL UNIQUE,
                token_hash TEXT NOT NULL UNIQUE,
                pet_name TEXT NOT NULL DEFAULT 'Biscuit',
                pet_avatar TEXT NOT NULL DEFAULT '🐶',
                pet_theme TEXT NOT NULL DEFAULT 'lavender',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
        from backend.api import token_digest
        connection.execute("INSERT INTO users (id, display_name, friend_code, token_hash) VALUES (?, ?, ?, ?)", ("legacy", "Legacy", "ABCDEFGH", token_digest("legacy-token")))
        connection.commit()
        connection.close()

        profile = self.client.get("/api/me", headers=self.auth("legacy-token"))
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.get_json()["profile"]["display_name"], "Legacy")
        check_connection = sqlite3.connect(self.database_path)
        try:
            columns = {row[1] for row in check_connection.execute("PRAGMA table_info(users)")}
        finally:
            check_connection.close()
        self.assertIn("email", columns)
        self.assertIn("password_hash", columns)

    def test_overlay_account_creation_still_works_and_api_allows_pages_cors(self):
        created = self.client.post("/api/users", json={"display_name": "Overlay"}, headers={"Origin": "https://hass-nation.github.io"})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.headers["Access-Control-Allow-Origin"], "https://hass-nation.github.io")
        profile = self.client.get("/api/me", headers=self.auth(created.get_json()["token"]))
        self.assertEqual(profile.status_code, 200)
        self.assertNotIn("email", profile.get_json()["profile"])


if __name__ == "__main__":
    unittest.main()
