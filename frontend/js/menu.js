import { CONFIG } from './config.js';

const STATE = {
    startEl: null, charModalEl: null, charGridEl: null,
    countdownEl: null, countdownTextEl: null,
    gameOverEl: null, finalScoreEl: null, newHighEl: null,
    hudEl: null, scoreValEl: null, bestValEl: null,
    cvBtnEl: null, cvTextEl: null,
    onPlay: null, onCharSelect: null
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

    STATE.bestValEl.textContent = String(getBest());

    document.getElementById('play-btn').addEventListener('click', () => {
        if (STATE.onPlay) STATE.onPlay();
    });

    document.getElementById('stats-btn').addEventListener('click', () => {
        alert('Stats coming soon!');
    });

    document.getElementById('char-btn').addEventListener('click', () => {
        showCharacterModal();
    });

    document.getElementById('char-close-btn').addEventListener('click', () => {
        STATE.charModalEl.classList.add('hidden');
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        if (STATE.onPlay) STATE.onPlay();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        STATE.gameOverEl.classList.add('hidden');
        STATE.startEl.classList.remove('hidden');
    });

    buildCharacterCards();

    // GSAP Intro Animation
    if (window.gsap) {
        gsap.from('.glass-panel', { duration: 0.8, y: 30, opacity: 0, ease: 'power3.out' });
        gsap.from('.game-title', { duration: 1, y: -20, opacity: 0, delay: 0.2, ease: 'power3.out' });
        gsap.from('.btn-primary, .btn-secondary', { 
            duration: 0.6, y: 20, opacity: 0, stagger: 0.1, delay: 0.4, ease: 'back.out(1.7)' 
        });
    }
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
    console.log('[menu] Character selected:', id);
    buildCharacterCards();
    if (STATE.onCharSelect) STATE.onCharSelect(id);
}

export function onCharacterSelect(cb) {
    STATE.onCharSelect = cb;
}

export function showCharacterModal() {
    buildCharacterCards();
    STATE.charModalEl.classList.remove('hidden');
    if (window.gsap) {
        gsap.fromTo('.char-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.3 });
    }
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
            
            if (window.gsap) {
                gsap.fromTo(STATE.countdownTextEl, 
                    { scale: 2, opacity: 0 }, 
                    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }
                );
            }

            n--;
            setTimeout(step, 800);
        } else {
            STATE.countdownTextEl.textContent = 'GO!';
            if (window.gsap) {
                gsap.fromTo(STATE.countdownTextEl, 
                    { scale: 0.5, opacity: 0 }, 
                    { scale: 1.2, opacity: 1, duration: 0.3, ease: 'power2.out' }
                );
            }
            setTimeout(() => {
                STATE.countdownEl.classList.add('hidden');
                onDone();
            }, 500);
        }
    }
    step();
}

export function showGameOver(score, isNewHigh, onRestart, onMenu) {
    STATE.finalScoreEl.textContent = String(score);
    if (isNewHigh) STATE.newHighEl.classList.remove('hidden');
    else STATE.newHighEl.classList.add('hidden');
    
    STATE.gameOverEl.classList.remove('hidden');
    if (window.gsap) {
        gsap.fromTo('.overlay-inner', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' });
    }
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