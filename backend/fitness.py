from __future__ import annotations

from collections import Counter


def estimate_metrics(
    *,
    steps: int,
    duration_seconds: float,
    cadence_spm: float,
    height_cm: float | None,
    weight_kg: float | None,
) -> dict[str, float | None]:
    if height_cm is None or weight_kg is None:
        return {"distance_m": None, "calories_kcal": None}

    distance_m = steps * (height_cm / 100) * 0.415
    if steps == 0 or duration_seconds <= 0:
        calories_kcal = 0.0
    else:
        met = min(12.0, max(1.0, 3.5 + max(0.0, cadence_spm - 60) * 0.065))
        calories_kcal = met * 3.5 * weight_kg / 200 * duration_seconds / 60

    return {
        "distance_m": round(distance_m, 1),
        "calories_kcal": round(calories_kcal, 1),
    }


def linear_weekly_forecast(weekly_distances_km: list[float]) -> dict[str, float | str | None]:
    if len(weekly_distances_km) < 3 or sum(value > 0 for value in weekly_distances_km) < 3:
        return {
            "predicted_km": None,
            "method": "linear_regression",
            "message": "Complete workouts in three separate weeks to enable a forecast.",
        }

    x_values = list(range(len(weekly_distances_km)))
    x_mean = sum(x_values) / len(x_values)
    y_mean = sum(weekly_distances_km) / len(weekly_distances_km)
    denominator = sum((x - x_mean) ** 2 for x in x_values)
    slope = sum(
        (x - x_mean) * (y - y_mean)
        for x, y in zip(x_values, weekly_distances_km)
    ) / denominator
    prediction = max(0.0, y_mean + slope * (len(weekly_distances_km) - x_mean))
    return {
        "predicted_km": round(prediction, 2),
        "method": "linear_regression",
        "message": "Trend-based estimate from completed weekly workout totals.",
    }


def cadence_clusters(cadences: list[float]) -> dict[str, object]:
    values = [value for value in cadences if value > 0]
    if len(values) < 3:
        return {
            "available": False,
            "method": "k_means",
            "message": "Three completed sessions with detected cadence are needed.",
            "counts": {},
        }

    cluster_count = min(3, len(values))
    ordered = sorted(values)
    centers = [
        ordered[round(i * (len(ordered) - 1) / (cluster_count - 1))]
        for i in range(cluster_count)
    ] if cluster_count > 1 else [sum(values) / len(values)]

    for _ in range(30):
        groups = [[] for _ in centers]
        for value in values:
            index = min(range(len(centers)), key=lambda i: abs(value - centers[i]))
            groups[index].append(value)
        next_centers = [
            sum(group) / len(group) if group else centers[index]
            for index, group in enumerate(groups)
        ]
        if all(abs(a - b) < 0.01 for a, b in zip(centers, next_centers)):
            break
        centers = next_centers

    ranked_centers = sorted(enumerate(centers), key=lambda pair: pair[1])
    names = ("low", "steady", "high")
    labels = {
        index: names[min(rank, len(names) - 1)]
        for rank, (index, _) in enumerate(ranked_centers)
    }
    counts = Counter(
        labels[min(range(len(centers)), key=lambda i: abs(value - centers[i]))]
        for value in values
    )
    return {
        "available": True,
        "method": "k_means",
        "message": "Cadence groups learned from your completed camera sessions.",
        "counts": dict(counts),
        "centers_spm": {
            labels[index]: round(center, 1)
            for index, center in ranked_centers
        },
    }
