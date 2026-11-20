# Influencer Run

A browser-based endless runner and camera-based fitness tracker. Camera pose detection runs locally in the browser; the FastAPI backend receives step counts and workout summaries, not camera frames.

## Run locally

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000), save your height and weight in **Fitness Dashboard**, allow camera access, and choose **Real-Time Jogger**. Camera access requires HTTPS or localhost. Keep your full body visible for step detection.

## Camera controls

Stand centered and still during calibration. Head movement is the primary control: lean left/right to change lanes, raise the head to jump, and lower it to roll. Face tracking drives controls on every camera frame; full-body pose inference runs less often for step estimates. Both run locally in the browser, and a fitness-service outage does not block a camera-controlled run. Workout profile and summary data are saved through the FastAPI backend when available. The preview reports camera capture FPS separately from head-tracking FPS.

The fitness dashboard lets you save weight, height, and a weekly distance goal. The backend persists the profile and completed workouts in `backend/fitness.sqlite3`.

## Fitness data and limitations

- The game’s virtual distance is labeled **GAME DISTANCE** and is not included in fitness metrics.
- The camera estimates steps from alternating ankle movement. Distance is estimated from steps and the saved height; calories are estimated from duration, detected cadence, and saved weight. These are not direct measurements and can be inaccurate, especially if body landmarks are occluded or the user is not running in place.
- A workout continues while you restart the runner after a collision. Choose **Finish Workout** at game over, or return to the main menu, to save it.
- The browser does not upload video or pose frames. Only step counts, cadence, and elapsed time are sent to the local API.
- The dashboard uses linear regression for a weekly distance forecast (after workouts in three separate weeks) and K-means clustering for cadence groups (after three sessions). Predictions are unavailable until enough history exists; neither is medical advice.
- This local demo has one shared profile and no account system. Set a distinct database path with `FITNESS_DB_PATH` when running tests or another instance.

Keyboard mode remains a game-only mode and does not create fitness workout records.
