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
            self.assertEqual(self.client.post(self.url, json={"text": "Hello!"}, headers=self.origin).status_code, 204)
            self.assertEqual(self.client.get(self.url).json["speech"]["text"], "Hello!")
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
