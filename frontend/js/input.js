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
export function attachKeyboard() {
    addEventListener('keydown', (e) => {
        if (e.repeat) return;   // held keys don't re-fire
        switch (e.key) {
            case 'ArrowLeft':  Input.push('left');  break;
            case 'ArrowRight': Input.push('right'); break;
            case 'ArrowUp':    Input.push('jump');  break;
            case 'ArrowDown':  Input.push('roll');  break;
        }
    });
}