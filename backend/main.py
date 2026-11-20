from __future__ import annotations

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.fitness import cadence_clusters, estimate_metrics, linear_weekly_forecast

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
DB_PATH = Path(os.environ.get("FITNESS_DB_PATH", Path(__file__).with_name("fitness.sqlite3")))

app = FastAPI(title="Influencer Run Fitness API", version="1.0.0")


class ProfileUpdate(BaseModel):
    weight_kg: float | None = Field(default=None, ge=30, le=250)
    height_cm: float | None = Field(default=None, ge=100, le=230)
    weekly_goal_km: float | None = Field(default=None, gt=0, le=500)


class SessionSample(BaseModel):
    elapsed_seconds: float = Field(ge=0, le=86400)
    steps: int = Field(ge=0, le=1_000_000)
    cadence_spm: float = Field(ge=0, le=300)


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def database():
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with database() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                weight_kg REAL,
                height_cm REAL,
                weekly_goal_km REAL NOT NULL DEFAULT 10,
                updated_at TEXT NOT NULL
            );
            INSERT OR IGNORE INTO profile (id, updated_at)
            VALUES (1, CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_seconds REAL NOT NULL DEFAULT 0,
                steps INTEGER NOT NULL DEFAULT 0,
                cadence_spm REAL NOT NULL DEFAULT 0,
                distance_m REAL,
                calories_kcal REAL,
                status TEXT NOT NULL DEFAULT 'active'
            );
            CREATE INDEX IF NOT EXISTS sessions_started_at_idx
            ON sessions(started_at);
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def profile_data(db: sqlite3.Connection) -> dict[str, Any]:
    row = db.execute(
        "SELECT weight_kg, height_cm, weekly_goal_km FROM profile WHERE id = 1"
    ).fetchone()
    return row_to_dict(row)


def metrics_for_sample(
    db: sqlite3.Connection,
    *,
    steps: int,
    duration_seconds: float,
    cadence_spm: float,
) -> dict[str, float | None]:
    profile = profile_data(db)
    return estimate_metrics(
        steps=steps,
        duration_seconds=duration_seconds,
        cadence_spm=cadence_spm,
        height_cm=profile["height_cm"],
        weight_kg=profile["weight_kg"],
    )


def save_sample(session_id: str, sample: SessionSample) -> dict[str, Any]:
    with database() as db:
        session = db.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if session is None:
            raise HTTPException(status_code=404, detail="Workout session not found.")
        if session["status"] != "active":
            raise HTTPException(status_code=409, detail="Workout session is already complete.")

        elapsed = max(float(session["duration_seconds"]), sample.elapsed_seconds)
        steps = max(int(session["steps"]), sample.steps)
        metrics = metrics_for_sample(
            db, steps=steps, duration_seconds=elapsed, cadence_spm=sample.cadence_spm
        )
        db.execute(
            """
            UPDATE sessions
            SET duration_seconds = ?, steps = ?, cadence_spm = ?,
                distance_m = ?, calories_kcal = ?
            WHERE id = ?
            """,
            (
                elapsed,
                steps,
                sample.cadence_spm,
                metrics["distance_m"],
                metrics["calories_kcal"],
                session_id,
            ),
        )
    return {
        "session_id": session_id,
        "duration_seconds": elapsed,
        "steps": steps,
        "cadence_spm": sample.cadence_spm,
        "estimated_distance_m": metrics["distance_m"],
        "estimated_calories_kcal": metrics["calories_kcal"],
        "requires_profile": metrics["distance_m"] is None,
    }


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/api/health")
def health() -> dict[str, str]:
    initialize_database()
    return {"status": "ok"}


@app.get("/api/profile")
def get_profile() -> dict[str, Any]:
    initialize_database()
    with database() as db:
        return profile_data(db)


@app.put("/api/profile")
def update_profile(payload: ProfileUpdate) -> dict[str, Any]:
    initialize_database()
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one profile value.")
    with database() as db:
        current = profile_data(db)
        current.update(updates)
        db.execute(
            """
            UPDATE profile
            SET weight_kg = ?, height_cm = ?, weekly_goal_km = ?, updated_at = ?
            WHERE id = 1
            """,
            (
                current["weight_kg"],
                current["height_cm"],
                current["weekly_goal_km"],
                iso_now(),
            ),
        )
        return current


@app.post("/api/sessions", status_code=201)
def start_session() -> dict[str, str]:
    initialize_database()
    with database() as db:
        profile = profile_data(db)
    if profile["height_cm"] is None or profile["weight_kg"] is None:
        raise HTTPException(
            status_code=409,
            detail="Save your height and weight in the fitness dashboard before starting a workout.",
        )
    session_id = uuid.uuid4().hex
    with database() as db:
        db.execute(
            "INSERT INTO sessions (id, started_at) VALUES (?, ?)",
            (session_id, iso_now()),
        )
    return {"session_id": session_id}


@app.post("/api/sessions/{session_id}/progress")
def update_session_progress(session_id: str, payload: SessionSample) -> dict[str, Any]:
    return save_sample(session_id, payload)


@app.post("/api/sessions/{session_id}/finish")
def finish_session(session_id: str, payload: SessionSample) -> dict[str, Any]:
    progress = save_sample(session_id, payload)
    with database() as db:
        db.execute(
            "UPDATE sessions SET status = 'completed', ended_at = ? WHERE id = ?",
            (iso_now(), session_id),
        )
    return progress


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    initialize_database()
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    current_week = week_start.isoformat()
    with database() as db:
        profile = profile_data(db)
        completed = db.execute(
            """
            SELECT id, started_at, duration_seconds, steps, cadence_spm,
                   distance_m, calories_kcal, status
            FROM sessions WHERE status = 'completed'
            ORDER BY started_at DESC LIMIT 50
            """
        ).fetchall()
        all_completed = db.execute(
            """
            SELECT started_at, distance_m, cadence_spm
            FROM sessions WHERE status = 'completed'
            ORDER BY started_at ASC
            """
        ).fetchall()

    recent = [row_to_dict(row) for row in completed]
    this_week = [row for row in recent if row["started_at"] >= current_week]
    weekly_distance_m = sum(row["distance_m"] or 0 for row in this_week)
    weekly_calories = sum(row["calories_kcal"] or 0 for row in this_week)
    goal_m = profile["weekly_goal_km"] * 1000

    weekly_totals: dict[str, float] = {}
    for row in all_completed:
        date = datetime.fromisoformat(row["started_at"])
        monday = (date - timedelta(days=date.weekday())).date().isoformat()
        weekly_totals[monday] = weekly_totals.get(monday, 0) + (row["distance_m"] or 0) / 1000
    previous_weeks = [
        (week_start - timedelta(weeks=offset)).date().isoformat()
        for offset in range(6, 0, -1)
    ]
    forecast = linear_weekly_forecast([weekly_totals.get(key, 0) for key in previous_weeks])
    clusters = cadence_clusters([row["cadence_spm"] for row in all_completed])
    has_profile = profile["height_cm"] is not None and profile["weight_kg"] is not None
    distance_for_week = round(weekly_distance_m, 1) if has_profile else None
    calories_for_week = round(weekly_calories, 1) if has_profile else None

    return {
        "profile": profile,
        "week": {
            "distance_m": distance_for_week,
            "calories_kcal": calories_for_week,
            "completed_runs": len(this_week),
            "goal_km": profile["weekly_goal_km"],
            "goal_progress_percent": round(min(100, weekly_distance_m / goal_m * 100), 1)
            if goal_m
            else 0,
        },
        "analytics": {"forecast": forecast, "cadence_clusters": clusters},
        "sessions": recent[:10],
        "measurement_note": "Distance and calorie values are camera-based estimates, not direct measurements.",
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
