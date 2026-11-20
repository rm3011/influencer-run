async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`/api${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
    } catch (error) {
        throw new Error('Fitness service is unavailable. Start the FastAPI server and try again.');
    }

    let body;
    try {
        body = await response.json();
    } catch {
        if (!response.ok) throw new Error(`Fitness service request failed (${response.status}).`);
        throw new Error('Fitness service returned an invalid response.');
    }
    if (!response.ok) {
        const detail = typeof body.detail === 'string' ? body.detail : 'Fitness service request failed.';
        throw new Error(detail);
    }
    return body;
}

export const startFitnessSession = () =>
    request('/sessions', { method: 'POST', body: '{}' });

export const updateFitnessSession = (sessionId, sample) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/progress`, {
        method: 'POST',
        body: JSON.stringify(sample)
    });

export const finishFitnessSession = (sessionId, sample) =>
    request(`/sessions/${encodeURIComponent(sessionId)}/finish`, {
        method: 'POST',
        body: JSON.stringify(sample)
    });

export const getFitnessDashboard = () => request('/dashboard');

export const saveFitnessProfile = (profile) =>
    request('/profile', { method: 'PUT', body: JSON.stringify(profile) });
