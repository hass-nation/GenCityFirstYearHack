from tempfile import TemporaryDirectory
import unittest

from app import create_app


class ScreenTimeTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        app = create_app()
        app.instance_path = directory.name
        self.client = app.test_client()

    def profile(self, name):
        data = self.client.post("/api/users", json={"display_name": name}).json
        return {"Authorization": f"Bearer {data['token']}"}, data["profile"]["friend_code"]

    def test_opt_in_publishes_only_total_to_friends_and_revocation_stops_sync(self):
        owner, code = self.profile("Owner")
        friend, _ = self.profile("Friend")
        outsider, _ = self.profile("Outsider")
        self.client.post("/api/friends", headers=friend, json={"friend_code": code})
        data = {"day": "2026-11-21", "seconds": 123, "apps": ["private"]}

        def friend_view():
            return self.client.get("/api/friends", headers=friend).json["friends"][0]

        self.assertFalse(self.client.post("/api/me/screen-time", headers=owner, json=data).json["enabled"])
        self.assertNotIn("screen_time", friend_view())
        self.assertEqual(self.client.patch("/api/me/screen-time", headers=owner, json={**data, "enabled": True}).status_code, 200)
        self.assertEqual(friend_view()["screen_time"], {"day": data["day"], "seconds": 123})
        self.assertEqual(self.client.get("/api/friends", headers=outsider).json["friends"], [])
        self.client.post("/api/me/screen-time", headers=owner, json={**data, "seconds": 300})
        self.assertEqual(friend_view()["screen_time"]["seconds"], 300)
        self.client.patch("/api/me/screen-time", headers=owner, json={"enabled": False})
        self.client.post("/api/me/screen-time", headers=owner, json=data)
        self.assertNotIn("screen_time", friend_view())
