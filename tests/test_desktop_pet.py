import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app import create_app


class DesktopPetTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.app = create_app()
        self.app.instance_path = directory.name
        self.client = self.app.test_client()
        self.origin = {"Origin": "http://localhost"}
        self.url = "/api/desktop-pet"

    def test_appearance_persists_and_speech_expires(self):
        self.assertEqual(self.client.get(self.url).json["appearance"], {"name": "Wobbles", "species": "camel"})
        appearance = {"name": "Wobbles", "species": "cat"}
        self.assertEqual(self.client.put(self.url, json=appearance, headers=self.origin).status_code, 204)
        self.assertEqual(self.client.get(self.url).json["appearance"], appearance)
        with patch("backend.desktop_pet.time", return_value=100):
            self.assertEqual(self.client.post(self.url, json={"text": "I leveled up!", "celebrate": True}, headers=self.origin).status_code, 204)
            speech = self.client.get(self.url).json["speech"]
            self.assertEqual(speech["text"], "I leveled up!")
            self.assertIs(speech["celebrate"], True)
        with patch("backend.desktop_pet.time", return_value=115):
            self.assertIsNone(self.client.get(self.url).json["speech"])

    def test_rejects_remote_and_cross_origin_calls(self):
        appearance = {"name": "Wobbles", "species": "dog"}
        self.assertEqual(self.client.put(self.url, json=appearance, headers={"Origin": "https://example.org"}).status_code, 403)
        self.assertEqual(self.client.get(self.url, environ_overrides={"REMOTE_ADDR": "203.0.113.2"}).status_code, 403)

    def test_rejects_invalid_custom_frames(self):
        appearance = {"name": "Wobbles", "species": "custom", "frames": ["not a PNG"]}
        self.assertEqual(self.client.put(self.url, json=appearance, headers=self.origin).status_code, 400)
        self.assertEqual(self.client.get(self.url).json["appearance"]["species"], "camel")

    def test_profile_token_can_coexist_with_ingress_authorization(self):
        created = self.client.post("/api/users", json={"display_name": "Tester"}).json
        response = self.client.get("/api/me", headers={
            "Authorization": "Bearer ingress-token",
            "X-PC-Pet-Token": created["token"],
        })
        self.assertEqual(response.json["profile"]["display_name"], "Tester")

    def test_friend_message_arrives_only_after_desktop_acknowledges_exit(self):
        def profile(name):
            created = self.client.post("/api/users", json={"display_name": name}).json
            return created["profile"]["friend_code"], {"Authorization": f"Bearer {created['token']}", **self.origin}

        _, sender = profile("Sender")
        code, recipient = profile("Recipient")
        self.client.post("/api/friends", json={"friend_code": code}, headers=sender)
        pending = self.client.post(f"{self.url}/delivery", json={"friend_code": code, "body": "Hello"}, headers=sender)
        self.assertEqual(pending.status_code, 202)
        delivery = f"{self.url}/delivery/{pending.json['id']}"
        self.assertEqual(self.client.get(delivery, headers=sender).json["status"], "walking")
        self.assertEqual(self.client.get("/api/messages", headers=recipient).json["messages"], [])
        self.assertEqual(self.client.post(f"{delivery}/complete", headers={"Origin": "https://example.org"}).status_code, 403)
        for _ in range(2):
            self.assertEqual(self.client.post(f"{delivery}/complete", headers=self.origin).status_code, 204)
        self.assertEqual(self.client.get(delivery, headers=sender).json["status"], "sent")
        self.assertEqual([message["body"] for message in self.client.get("/api/messages", headers=recipient).json["messages"]], ["Hello"])
