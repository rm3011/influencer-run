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
    const { profile, week } = data;
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

    renderHistory(data.sessions);
}

function renderDataScienceDashboard(data) {
    const { forecast } = data.analytics;
    const clusters = data.analytics.cadence_clusters;
    const groups = ['low', 'steady', 'high'];
    const counts = clusters.counts || {};
    const centers = clusters.centers_spm || {};
    const totalSamples = clusters.sample_count ??
        groups.reduce((total, name) => total + (counts[name] || 0), 0);
    const maxCount = Math.max(1, ...groups.map((name) => counts[name] || 0));

    $('science-forecast-value').textContent = forecast.predicted_km == null
        ? 'MORE DATA NEEDED'
        : `~${forecast.predicted_km.toFixed(1)} km`;
    $('science-forecast-detail').textContent = forecast.message;
    $('science-cadence-samples').textContent = totalSamples.toLocaleString();
    $('science-cadence-sample-note').textContent = clusters.available
        ? 'Completed sessions included in the cadence groups.'
        : clusters.message;
    $('science-cluster-state').textContent = clusters.available ? 'GROUPS READY' : 'NEEDS MORE DATA';
    $('science-cluster-detail').textContent = clusters.message;

    for (const name of groups) {
        const count = counts[name] || 0;
        const center = centers[name];
        $(`science-${name}-count`).textContent = count.toLocaleString();
        $(`science-${name}-center`).textContent = center == null ? '-- spm' : `${Math.round(center)} spm`;
        $(`science-${name}-bar`).style.width = `${count / maxCount * 100}%`;
    }
}

function setScienceStatus(message, isError = false) {
    const status = $('science-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
}

export function initFitnessDashboard() {
    $('dashboard-close-btn').addEventListener('click', () => $('fitness-dashboard').classList.add('hidden'));
    $('dashboard-data-science-btn').addEventListener('click', showDataScienceDashboard);
    $('science-close-btn').addEventListener('click', () => $('data-science-dashboard').classList.add('hidden'));
    $('science-fitness-btn').addEventListener('click', showFitnessDashboard);
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
    $('data-science-dashboard').classList.add('hidden');
    $('fitness-dashboard').classList.remove('hidden');
    void refreshFitnessDashboard();
}

export async function refreshDataScienceDashboard() {
    setScienceStatus('Loading workout analytics…');
    try {
        const data = await getFitnessDashboard();
        renderDataScienceDashboard(data);
        setScienceStatus(data.measurement_note);
        return true;
    } catch (error) {
        setScienceStatus(error.message, true);
        return false;
    }
}

export function showDataScienceDashboard() {
    $('fitness-dashboard').classList.add('hidden');
    $('data-science-dashboard').classList.remove('hidden');
    void refreshDataScienceDashboard();
}
