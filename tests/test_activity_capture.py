import unittest
from unittest.mock import patch

from app import create_app


class ActivityCaptureTest(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    @patch("backend.activity_api.capture_sessions")
    def test_local_browser_can_capture_windows_sessions(self, capture):
        apps = [{"name": "anki", "sessions": [{"start": "start", "end": "end"}]}]
        capture.return_value = (apps, None)
        response = self.client.post("/api/activity/capture", json={}, headers={"Origin": "http://localhost"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"apps": apps})
        capture.assert_called_once_with(seconds=2)

    @patch("backend.activity_api.capture_sessions")
    def test_remote_and_cross_origin_calls_do_not_read_the_desktop(self, capture):
        for remote, origin in [("203.0.113.2", "http://localhost"), ("127.0.0.1", "https://example.com")]:
            response = self.client.post("/api/activity/capture", json={}, headers={"Origin": origin},
                                        environ_overrides={"REMOTE_ADDR": remote})
            self.assertEqual(response.status_code, 403)
        capture.assert_not_called()

    @patch("backend.activity_api.list_open_app_tabs")
    def test_tabs_stay_grouped_by_app_and_window(self, list_tabs):
        windows = {"chrome": [{"windowId": 1, "tabs": ["Moodle"]}, {"windowId": 2, "tabs": ["Docs"]}]}
        list_tabs.return_value = windows
        blocked = self.client.post("/api/activity/tabs", json={}, headers={"Origin": "https://example.com"})
        self.assertEqual(blocked.status_code, 403)
        list_tabs.assert_not_called()
        response = self.client.post("/api/activity/tabs", json={}, headers={"Origin": "http://localhost"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"windows": windows})
        self.assertEqual(response.headers["Cache-Control"], "no-store")
