import os
import unittest
from unittest.mock import Mock, patch

import requests

from app import create_app


class PetChatTest(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()
        environment = patch.dict(os.environ, {
            "SNOWFLAKE_ACCOUNT_URL": "https://demo.snowflakecomputing.com",
            "SNOWFLAKE_TOKEN": "test-token",
            "PET_AGENT_DB": "PC PET",
            "PET_AGENT_SCHEMA": "PUBLIC",
            "PET_AGENT_NAME": "",
        })
        environment.start()
        self.addCleanup(environment.stop)

    @patch("app.chat.requests.post")
    def test_agent_joins_text_and_restores_history(self, post):
        post.return_value.json.return_value = {"role": "assistant", "content": [
            {"type": "text", "text": "Let's study."},
            {"type": "thinking", "text": "skip"},
            {"type": "text", "text": "One step at a time."},
        ]}
        result = self.client.post("/pet/chat", json={"message": "Help me", "context": {
            "pet": {"name": "Pixel", "level": 3}, "next_task": {"title": "Maths"}, "streak": 4,
        }})
        self.assertEqual(result.json, {"reply": "Let's study.\nOne step at a time.", "source": "agent"})
        url, = post.call_args.args
        self.assertTrue(url.endswith("/databases/PC%20PET/schemas/PUBLIC/agents/PC_PET_AGENT:run"))
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-token")
        self.assertEqual(kwargs["timeout"], 8)
        self.assertIs(kwargs["json"]["stream"], False)
        prompt = kwargs["json"]["messages"][0]["content"][0]["text"]
        self.assertIn("Maths", prompt)
        self.assertIn("streak=4", prompt)
        self.client.post("/pet/chat", json={"message": "What next?"})
        messages = post.call_args.kwargs["json"]["messages"]
        self.assertEqual([m["role"] for m in messages], ["user", "assistant", "user"])
        self.assertEqual(messages[0]["content"][0]["text"], "Help me")

    @patch("app.chat.requests.post", side_effect=requests.Timeout)
    def test_timeout_uses_scripted_chat(self, post):
        result = self.client.post("/pet/chat", json={"message": "study"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["source"], "scripted")
        self.assertIn("20 XP", result.json["reply"])

    @patch("app.chat.requests.post")
    def test_server_error_uses_scripted_chat(self, post):
        response = requests.Response()
        response.status_code = 500
        post.return_value = response
        self.assertEqual(self.client.post("/pet/chat", json={"message": "hi"}).json["source"], "scripted")

    @patch("app.chat.requests.post")
    def test_empty_reply_and_missing_config_use_fallback(self, post):
        post.return_value = Mock()
        post.return_value.json.return_value = {"content": [{"type": "text", "text": " "}]}
        self.assertEqual(self.client.post("/pet/chat", json={"message": "hi"}).json["source"], "scripted")
        post.reset_mock()
        with patch.dict(os.environ, {"SNOWFLAKE_TOKEN": ""}):
            self.assertEqual(self.client.post("/pet/chat", json={"message": "hi"}).json["source"], "scripted")
        post.assert_not_called()

    def test_pet_page_serves_vanilla_chat(self):
        page = self.client.get("/pet")
        self.addCleanup(page.close)
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"/pet/chat", page.data)
        javascript = self.client.get("/static/pet-chat.js")
        self.addCleanup(javascript.close)
        self.assertEqual(javascript.status_code, 200)
