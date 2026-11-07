export const Input = {
    _queue: [],

    push(action) {
        // De-dupe: don't push the same action twice in a row.
        // CV fires at 15Hz; without this, a held lean would spam
        // 'left' and slam the lane to the edge.
        const last = this._queue[this._queue.length - 1];
        if (last !== action) this._queue.push(action);
    },

    drain() {
        const q = this._queue;
        this._queue = [];
        return q;
    },

    clear() {
        this._queue = [];
    }
};

// --- Keyboard adapter (always active) ---
export function attachKeyboard(enabled = () => true) {
    addEventListener('keydown', (e) => {
        if (e.repeat || !enabled()) return;
        const action = {
            ArrowLeft: 'left', a: 'left', A: 'left',
            ArrowRight: 'right', d: 'right', D: 'right',
            ArrowUp: 'jump', w: 'jump', W: 'jump',
            ArrowDown: 'roll', s: 'roll', S: 'roll'
        }[e.key];
        if (action) {
            e.preventDefault();
            Input.push(action);
        }
    });
}

export function attachTouch(enabled = () => true) {
    let start = null;
    document.addEventListener('touchstart', (e) => {
        if (!enabled() || e.target.closest('button, input, textarea, select')) return;
        const touch = e.changedTouches[0];
        start = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!start || !enabled()) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        start = null;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        Input.push(Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? 'left' : 'right')
            : (dy < 0 ? 'jump' : 'roll'));
    }, { passive: true });
}