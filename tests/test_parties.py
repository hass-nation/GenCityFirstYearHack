from tempfile import TemporaryDirectory
import unittest

from app import create_app


class PartyTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        app = create_app()
        app.instance_path = directory.name
        self.client = app.test_client()
        self.host = self.profile("Host")
        self.guest = self.profile("Guest")

    def profile(self, name):
        token = self.client.post("/api/users", json={"display_name": name}).json["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_two_players_share_ready_state_and_focus_timer(self):
        party = self.client.post("/api/parties", headers=self.host).json["party"]
        self.assertEqual(party["status"], "lobby")
        self.assertIsNone(self.client.get("/api/parties/current", headers=self.guest).json["party"])
        self.assertEqual(self.client.patch("/api/parties/current", headers=self.host, json={"action": "start"}).status_code, 409)
        joined = self.client.post("/api/parties/join", headers=self.guest, json={"code": party["code"]})
        self.assertEqual(len(joined.json["party"]["members"]), 2)
        self.assertEqual(self.client.patch("/api/parties/current", headers=self.guest, json={"action": "start"}).status_code, 403)
        for player in (self.host, self.guest):
            self.assertEqual(self.client.patch("/api/parties/current", headers=player, json={"action": "ready", "ready": True}).status_code, 200)
        started = self.client.patch("/api/parties/current", headers=self.host, json={"action": "start"}).json["party"]
        self.assertEqual(started["status"], "active")
        guest_view = self.client.get("/api/parties/current", headers=self.guest).json["party"]
        self.assertEqual(guest_view["ends_at"], started["ends_at"])
        self.assertEqual(self.client.patch("/api/parties/current", headers=self.host, json={"action": "reset"}).json["party"]["status"], "lobby")

    def test_membership_is_unique_and_host_transfers_on_leave(self):
        self.assertEqual(self.client.post("/api/parties").status_code, 401)
        party = self.client.post("/api/parties", headers=self.host).json["party"]
        self.assertEqual(self.client.post("/api/parties", headers=self.host).status_code, 409)
        for _ in range(2):
            response = self.client.post("/api/parties/join", headers=self.guest, json={"code": party["code"]})
            self.assertEqual(len(response.json["party"]["members"]), 2)
        self.client.delete("/api/parties/current", headers=self.host)
        remaining = self.client.get("/api/parties/current", headers=self.guest).json["party"]
        self.assertEqual(remaining["host_id"], remaining["members"][0]["id"])
        self.client.delete("/api/parties/current", headers=self.guest)
        self.assertEqual(self.client.post("/api/parties/join", headers=self.host, json={"code": party["code"]}).status_code, 404)
