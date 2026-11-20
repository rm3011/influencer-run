import { getFitnessDashboard, saveFitnessProfile } from './fitness-api.js';

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
    const status = $('dashboard-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
}

function renderHistory(sessions) {
    const history = $('dashboard-history');
    history.replaceChildren();
    if (!sessions.length) {
        const empty = document.createElement('p');
        empty.className = 'history-empty';
        empty.textContent = 'No completed camera workouts yet.';
        history.appendChild(empty);
        return;
    }

    for (const session of sessions) {
        const row = document.createElement('div');
        row.className = 'history-row';
        const date = document.createElement('span');
        date.textContent = new Date(session.started_at).toLocaleString();
        const metrics = document.createElement('span');
        metrics.textContent = `${session.distance_m == null ? '--' : `~${(session.distance_m / 1000).toFixed(2)} km`} · ${session.steps} steps`;
        row.append(date, metrics);
        history.appendChild(row);
    }
}

function renderDashboard(data) {
    const { profile, week, analytics } = data;
    $('dashboard-distance').textContent = week.distance_m == null
        ? '--'
        : `~${(week.distance_m / 1000).toFixed(2)} km`;
    $('dashboard-calories').textContent = week.calories_kcal == null
        ? '--'
        : `~${Math.round(week.calories_kcal)} kcal`;
    $('dashboard-runs').textContent = String(week.completed_runs);
    $('dashboard-goal-progress').textContent = `${week.goal_progress_percent}%`;
    $('profile-weight').value = profile.weight_kg ?? '';
    $('profile-height').value = profile.height_cm ?? '';
    $('profile-goal').value = profile.weekly_goal_km;

    const forecast = analytics.forecast;
    $('dashboard-forecast').textContent = forecast.predicted_km == null
        ? forecast.message
        : `${forecast.message} Next-week distance: ~${forecast.predicted_km.toFixed(1)} km.`;
    const clusters = analytics.cadence_clusters;
    $('dashboard-cluster').textContent = clusters.available
        ? `${clusters.message} ${Object.entries(clusters.counts).map(([name, count]) => `${name}: ${count}`).join(' · ')}`
        : clusters.message;
    renderHistory(data.sessions);
}

export function initFitnessDashboard() {
    $('dashboard-close-btn').addEventListener('click', () => $('fitness-dashboard').classList.add('hidden'));
    $('fitness-profile-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const profile = {
            weight_kg: Number(values.get('weight_kg')),
            height_cm: Number(values.get('height_cm')),
            weekly_goal_km: Number(values.get('weekly_goal_km'))
        };
        try {
            await saveFitnessProfile(profile);
            if (await refreshFitnessDashboard()) setStatus('Profile and weekly goal saved.');
        } catch (error) {
            setStatus(error.message, true);
        }
    });
}

export async function refreshFitnessDashboard() {
    setStatus('Loading fitness data…');
    try {
        const data = await getFitnessDashboard();
        renderDashboard(data);
        setStatus(data.measurement_note);
        return true;
    } catch (error) {
        setStatus(error.message, true);
        return false;
    }
}

export function showFitnessDashboard() {
    $('fitness-dashboard').classList.remove('hidden');
    void refreshFitnessDashboard();
}
