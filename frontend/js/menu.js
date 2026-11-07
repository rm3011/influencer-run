import { CONFIG } from './config.js';

// --- Public API used by main.js ---
// initUI()           — wire menu buttons, hide HUD, load best score
// showStart(onPlay)  — show start screen, call onPlay when Play clicked
// showCharacterModal() — open character select
// showCountdown(from, onDone) — "3..2..1..GO"
// showGameOver(score, isNewHigh, onRestart, onMenu) — game over screen
// hideAllOverlays()  — hide every overlay
// showHUD(show)      — toggle score HUD
// setScore(v, animate) — update score, optional pulse
// setBest(v)         — update best score display
// setCVStatus(state) — 'off' | 'loading' | 'calibrating' | 'ready' | 'error'

const STATE = {
    startEl: null,
    charModalEl: null,
    charGridEl: null,
    countdownEl: null,
    countdownTextEl: null,
    gameOverEl: null,
    finalScoreEl: null,
    newHighEl: null,
    hudEl: null,
    scoreValEl: null,
    bestValEl: null,
    cvBtnEl: null,
    cvTextEl: null,
    onPlay: null,
    onCharSelect: null
};

const BEST_KEY = 'influencer-run-best';

export function getBest() {
    return parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
}

export function setBest(v) {
    localStorage.setItem(BEST_KEY, String(v));
    if (STATE.bestValEl) STATE.bestValEl.textContent = String(v);
}

export function initUI() {
    STATE.startEl        = document.getElementById('start-screen');
    STATE.charModalEl    = document.getElementById('char-modal');
    STATE.charGridEl     = document.getElementById('char-grid');
    STATE.countdownEl    = document.getElementById('countdown');
    STATE.countdownTextEl= document.getElementById('countdown-text');
    STATE.gameOverEl     = document.getElementById('game-over');
    STATE.finalScoreEl   = document.getElementById('final-score-value');
    STATE.newHighEl      = document.getElementById('new-high');
    STATE.hudEl          = document.getElementById('hud');
    STATE.scoreValEl     = document.getElementById('score-value');
    STATE.bestValEl      = document.getElementById('best-value');
    STATE.cvBtnEl        = document.getElementById('cv-btn');
    STATE.cvTextEl       = STATE.cvBtnEl.querySelector('.cv-text');

    // Best score
    STATE.bestValEl.textContent = String(getBest());

    // Play button
    document.getElementById('play-btn').addEventListener('click', () => {
        if (STATE.onPlay) STATE.onPlay();
    });

    // Stats (placeholder)
    document.getElementById('stats-btn').addEventListener('click', () => {
        alert('Stats coming soon!');
    });

    // Character modal open
    document.getElementById('char-btn').addEventListener('click', () => {
        showCharacterModal();
    });

    // Character modal close
    document.getElementById('char-close-btn').addEventListener('click', () => {
        STATE.charModalEl.classList.add('hidden');
    });

    // Restart
    document.getElementById('restart-btn').addEventListener('click', () => {
        if (STATE.onPlay) STATE.onPlay();
    });

    // Main menu
    document.getElementById('menu-btn').addEventListener('click', () => {
        STATE.gameOverEl.classList.add('hidden');
        STATE.startEl.classList.remove('hidden');
    });

    // Build character cards
    buildCharacterCards();
}

function buildCharacterCards() {
    STATE.charGridEl.innerHTML = '';
    const chars = CONFIG.characters || {};
    const current = CONFIG.currentCharacter;

    for (const [id, ch] of Object.entries(chars)) {
        const card = document.createElement('div');
        card.className = 'char-card' + (id === current ? ' selected' : '');
        card.dataset.charId = id;

        const preview = document.createElement('div');
        preview.className = 'char-preview';
        preview.textContent = ch.name.charAt(0).toUpperCase();
        card.appendChild(preview);

        const name = document.createElement('div');
        name.className = 'char-name';
        name.textContent = ch.name;
        card.appendChild(name);

        if (id === current) {
            const badge = document.createElement('div');
            badge.className = 'char-badge';
            badge.textContent = 'SELECTED';
            card.appendChild(badge);
        }

        card.addEventListener('click', () => selectCharacter(id));
        STATE.charGridEl.appendChild(card);
    }
}

function selectCharacter(id) {
    CONFIG.currentCharacter = id;
    // Note: swapping the actual 3D model at runtime is a future enhancement.
    // For now, this only updates the config + UI. Console note for devs:
    console.log('[menu] Character selected:', id,
                '- model swap pending: reload to load', CONFIG.characters[id].model);
    // Re-render cards
    buildCharacterCards();
    // Notify any listener (main.js can optionally refresh coin appearance)
    if (STATE.onCharSelect) STATE.onCharSelect(id);
}

export function onCharacterSelect(cb) {
    STATE.onCharSelect = cb;
}

export function showCharacterModal() {
    buildCharacterCards();
    STATE.charModalEl.classList.remove('hidden');
}

export function showStart(onPlay) {
    STATE.onPlay = onPlay;
    STATE.startEl.classList.remove('hidden');
    STATE.gameOverEl.classList.add('hidden');
    STATE.countdownEl.classList.add('hidden');
    STATE.hudEl.classList.add('hidden');
}

export function showCountdown(from, onDone) {
    STATE.startEl.classList.add('hidden');
    STATE.gameOverEl.classList.add('hidden');
    STATE.hudEl.classList.remove('hidden');
    STATE.countdownEl.classList.remove('hidden');

    let n = from;
    function step() {
        if (n > 0) {
            STATE.countdownTextEl.textContent = String(n);
            // Re-trigger animation
            STATE.countdownTextEl.style.animation = 'none';
            void STATE.countdownTextEl.offsetWidth;
            STATE.countdownTextEl.style.animation = '';
            n--;
            setTimeout(step, 700);
        } else {
            STATE.countdownTextEl.textContent = 'GO!';
            setTimeout(() => {
                STATE.countdownEl.classList.add('hidden');
                onDone();
            }, 400);
        }
    }
    step();
}

export function showGameOver(score, isNewHigh, onRestart, onMenu) {
    STATE.finalScoreEl.textContent = String(score);
    if (isNewHigh) STATE.newHighEl.classList.remove('hidden');
    else STATE.newHighEl.classList.add('hidden');
    STATE.gameOverEl.classList.remove('hidden');
    // Rebind (they were bound in initUI but re-bind here to be safe)
    // Actually, use stored callbacks
}

export function hideAllOverlays() {
    STATE.startEl.classList.add('hidden');
    STATE.charModalEl.classList.add('hidden');
    STATE.countdownEl.classList.add('hidden');
    STATE.gameOverEl.classList.add('hidden');
}

export function showHUD(show) {
    if (show) STATE.hudEl.classList.remove('hidden');
    else STATE.hudEl.classList.add('hidden');
}

export function setScore(v, animate) {
    STATE.scoreValEl.textContent = String(v);
    if (animate) {
        STATE.scoreValEl.classList.remove('bump');
        void STATE.scoreValEl.offsetWidth;
        STATE.scoreValEl.classList.add('bump');
        setTimeout(() => STATE.scoreValEl.classList.remove('bump'), 160);
    }
}

export function setCVStatus(state) {
    if (!STATE.cvBtnEl) return;
    STATE.cvBtnEl.classList.remove('off', 'loading', 'calibrating', 'ready', 'error');
    STATE.cvBtnEl.classList.add(state);

    const labels = {
        off:         'Enable Camera',
        loading:     'Loading model...',
        calibrating: 'Stand still...',
        ready:       'Camera Active',
        error:       'Camera Error'
    };
    STATE.cvTextEl.textContent = labels[state] || 'Camera';
}