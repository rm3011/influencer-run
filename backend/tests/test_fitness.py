import unittest

from backend.fitness import cadence_clusters, estimate_metrics, linear_weekly_forecast


class FitnessModelTests(unittest.TestCase):
    def test_metrics_require_profile_data(self):
        result = estimate_metrics(
            steps=100,
            duration_seconds=120,
            cadence_spm=100,
            height_cm=None,
            weight_kg=65,
        )
        self.assertIsNone(result["distance_m"])
        self.assertIsNone(result["calories_kcal"])

    def test_metrics_are_estimates_based_on_steps_and_profile(self):
        result = estimate_metrics(
            steps=100,
            duration_seconds=120,
            cadence_spm=100,
            height_cm=170,
            weight_kg=65,
        )
        self.assertEqual(result["distance_m"], 70.5)
        self.assertGreater(result["calories_kcal"], 0)

    def test_regression_waits_for_enough_history_and_predicts_trend(self):
        self.assertIsNone(linear_weekly_forecast([3.0, 4.0])["predicted_km"])
        self.assertIsNone(linear_weekly_forecast([3.0, 0.0, 4.0])["predicted_km"])
        result = linear_weekly_forecast([3.0, 4.0, 5.0])
        self.assertEqual(result["predicted_km"], 6.0)
        self.assertEqual(result["method"], "linear_regression")

    def test_k_means_needs_three_cadence_samples(self):
        insufficient = cadence_clusters([90, 100])
        self.assertFalse(insufficient["available"])
        self.assertEqual(insufficient["sample_count"], 2)
        result = cadence_clusters([80, 85, 140, 145, 180, 185])
        self.assertTrue(result["available"])
        self.assertEqual(result["sample_count"], 6)
        self.assertEqual(set(result["counts"]), {"low", "steady", "high"})


if __name__ == "__main__":
    unittest.main()
