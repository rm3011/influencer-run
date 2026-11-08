import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const S = { onPlay: null, onJogger: null, onRestart: null, onMenu: null, onCharSelect: null };

const BEST_KEY = 'influencer-run-best';
const STATS_KEY = 'influencer-run-stats';

export const getBest = () => parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
export function setBest(v) {
    localStorage.setItem(BEST_KEY, String(v));
    $('best-value').textContent = String(v);
}

export function getStats() {
    try {
        return Object.assign({ runs: 0, coins: 0, distance: 0 }, JSON.parse(localStorage.getItem(STATS_KEY) || '{}'));
    } catch { return { runs: 0, coins: 0, distance: 0 }; }
}
export function recordRun({ coins, distance }) {
    const s = getStats();
    s.runs += 1; s.coins += coins; s.distance += distance;
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

export function initUI() {
    $('best-value').textContent = String(getBest());
    setCollectibleDisplay(CONFIG.currentCharacter);

    $('keyboard-btn').addEventListener('click', () => S.onPlay && S.onPlay());
    $('jogger-btn').addEventListener('click', () => S.onJogger && S.onJogger());
    $('restart-btn').addEventListener('click', () => S.onRestart && S.onRestart());
    $('char-btn').addEventListener('click', showCharacterModal);
    $('char-close-btn').addEventListener('click', () => hide($('char-modal')));
    $('stats-btn').addEventListener('click', showStats);
    $('stats-close-btn').addEventListener('click', () => hide($('stats-modal')));
    $('menu-btn').addEventListener('click', () => {
        hide($('game-over'));
        hide($('hud'));
        show($('start-screen'));
        animateIn('#start-screen');
        if (S.onMenu) S.onMenu();
    });

    buildCharacterCards();
    animateIn('#start-screen');
}

function animateIn(sel) {
    if (!window.gsap) return;
    gsap.fromTo(`${sel} .glass-panel`, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
    gsap.fromTo(`${sel} .title-line`, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, delay: 0.1, ease: 'back.out(1.6)' });
    gsap.fromTo(`${sel} .btn-primary, ${sel} .btn-secondary`, { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, delay: 0.3, ease: 'back.out(1.7)' });
}

function buildCharacterCards() {
    const grid = $('char-grid');
    grid.innerHTML = '';
    for (const [id, ch] of Object.entries(CONFIG.characters)) {
        const selected = id === CONFIG.currentCharacter;
        const card = document.createElement('div');
        card.className = 'char-card' + (selected ? ' selected' : '');
        const preview = id === 'bheem'
            ? '<img src="./assets/images/bheem.png" alt="">'
            : ch.name.charAt(0).toUpperCase();
        card.innerHTML = `<div class="char-preview">${preview}</div>
                          <div class="char-name">${ch.name}</div>
                          ${selected ? '<div class="char-badge">SELECTED</div>' : ''}`;
        card.addEventListener('click', () => {
            CONFIG.currentCharacter = id;
            setCollectibleDisplay(id);
            buildCharacterCards();
            if (S.onCharSelect) S.onCharSelect(id);
        });
        grid.appendChild(card);
    }
}

function showCharacterModal() {
    buildCharacterCards();
    show($('char-modal'));
    if (window.gsap) gsap.fromTo('#char-modal .char-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.3 });
}

function showStats() {
    const s = getStats();
    $('st-best').textContent = getBest();
    $('st-runs').textContent = s.runs;
    $('st-coins').textContent = s.coins;
    $('st-dist').textContent = Math.round(s.distance).toLocaleString() + ' m';
    $('st-kcal').textContent = Math.round(s.distance * CONFIG.game.kcalPerMeter).toLocaleString();
    show($('stats-modal'));
    if (window.gsap) gsap.fromTo('#stats-modal .stat-box', { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.3 });
}

export const onMenu = (cb) => { S.onMenu = cb; };
export const onCharacterSelect = (cb) => { S.onCharSelect = cb; };

export function showStart(onPlay, onJogger, onRestart) {
    S.onPlay = onPlay;
    S.onJogger = onJogger;
    S.onRestart = onRestart;
    show($('start-screen'));
    hide($('game-over')); hide($('countdown')); hide($('hud'));
}

export function setModeStatus(message, disabled = false, isError = false) {
    $('mode-status').textContent = message;
    $('mode-status').classList.toggle('mode-status-error', isError);
    $('keyboard-btn').disabled = disabled;
    $('jogger-btn').disabled = disabled;
}

export function setControlStatus(message, isError = false) {
    const status = $('control-status');
    status.textContent = message;
    status.classList.toggle('status-error', isError);
}

function setCollectibleDisplay(characterId) {
    const icon = document.querySelector('.coin-ico, .ladoo-ico');
    const isLadoo = CONFIG.characters[characterId].collectibleType === 'ladoo';
    icon.classList.toggle('coin-ico', !isLadoo);
    icon.classList.toggle('ladoo-ico', isLadoo);
    icon.setAttribute('aria-label', isLadoo ? 'Ladoos' : 'Coins');
    icon.title = isLadoo ? 'Ladoos' : 'Coins';
}

export function showCountdown(from, onDone) {
    hide($('start-screen')); hide($('game-over'));
    show($('hud')); show($('countdown'));
    const el = $('countdown-text');
    let n = from;
    (function step() {
        if (n > 0) {
            el.textContent = String(n);
            if (window.gsap) gsap.fromTo(el, { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
            n--;
            setTimeout(step, 800);
        } else {
            el.textContent = 'GO!';
            if (window.gsap) gsap.fromTo(el, { scale: 0.5, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.3, ease: 'power2.out' });
            setTimeout(() => { hide($('countdown')); onDone(); }, 500);
        }
    })();
}

export function showGameOver(score, isNewHigh, { coins = 0, distance = 0 } = {}) {
    $('final-score-value').textContent = String(score);
    $('go-coins').textContent = String(coins);
    $('go-dist').textContent = Math.round(distance) + ' m';
    $('go-kcal').textContent = String(Math.round(distance * CONFIG.game.kcalPerMeter));
    isNewHigh ? show($('new-high')) : hide($('new-high'));
    show($('game-over'));
    if (window.gsap) {
        gsap.fromTo('#game-over .overlay-inner', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' });
    }
}

export function hideAllOverlays() {
    for (const id of ['start-screen', 'char-modal', 'stats-modal', 'countdown', 'game-over']) hide($(id));
}

function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 160);
}

export function setScore(v, animate) {
    const el = $('score-value');
    el.textContent = String(v);
    if (animate) bump(el);
}
export function setCoins(v, animate) {
    const el = $('coins-value');
    el.textContent = String(v);
    if (animate) bump(el);
}
export function setDistance(m) {
    $('dist-value').textContent = String(Math.floor(m));
    $('kcal-value').textContent = String(Math.floor(m * CONFIG.game.kcalPerMeter));
}
