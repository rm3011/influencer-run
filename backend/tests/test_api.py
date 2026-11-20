import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend import main


class FitnessApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = main.DB_PATH
        main.DB_PATH = Path(self.temp_dir.name) / "test.sqlite3"
        self.client_context = TestClient(main.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        main.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_workout_requires_profile_and_persists_backend_estimates(self):
        response = self.client.post("/api/sessions")
        self.assertEqual(response.status_code, 409)

        profile = self.client.put(
            "/api/profile",
            json={"weight_kg": 65, "height_cm": 170, "weekly_goal_km": 8},
        )
        self.assertEqual(profile.status_code, 200)

        session_id = self.client.post("/api/sessions").json()["session_id"]
        sample = {"elapsed_seconds": 60, "steps": 100, "cadence_spm": 100}
        progress = self.client.post(f"/api/sessions/{session_id}/progress", json=sample)
        self.assertEqual(progress.status_code, 200)
        self.assertEqual(progress.json()["estimated_distance_m"], 70.5)
        self.assertGreater(progress.json()["estimated_calories_kcal"], 0)

        finished = self.client.post(f"/api/sessions/{session_id}/finish", json=sample)
        self.assertEqual(finished.status_code, 200)
        dashboard = self.client.get("/api/dashboard").json()
        self.assertEqual(dashboard["week"]["completed_runs"], 1)
        self.assertEqual(dashboard["sessions"][0]["steps"], 100)

    def test_profile_bounds_are_validated(self):
        response = self.client.put("/api/profile", json={"height_cm": 20})
        self.assertEqual(response.status_code, 422)

if __name__ == "__main__":
    unittest.main()
