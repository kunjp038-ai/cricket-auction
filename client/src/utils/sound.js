/**
 * Auction sounds generated with the Web Audio API (no audio files needed).
 * Browsers only allow sound after a user gesture, so `unlockAudio()` is called on the
 * first click / key press and from the 🔊 toggle button.
 */
const KEY = 'auction_sound';
let ctx = null;
let enabled = (() => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
})();

export function isSoundEnabled() { return enabled; }

export function setSoundEnabled(v) {
  enabled = Boolean(v);
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
  if (enabled) unlockAudio();
}

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch (e) {
    return false;
  }
}

export function isAudioReady() { return Boolean(ctx && ctx.state === 'running'); }

function tone({ freq = 880, duration = 0.08, type = 'sine', gain = 0.25, when = 0, slideTo = null }) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Soft tick for the last 10 seconds. */
export function playTick() { tone({ freq: 880, duration: 0.07, gain: 0.2 }); }

/** Sharper tick for the last 5 seconds. */
export function playUrgentTick() { tone({ freq: 1320, duration: 0.09, type: 'square', gain: 0.18 }); }

/** Buzzer when the timer reaches zero. */
export function playBuzzer() {
  tone({ freq: 220, duration: 0.35, type: 'sawtooth', gain: 0.3, when: 0 });
  tone({ freq: 220, duration: 0.35, type: 'sawtooth', gain: 0.3, when: 0.42 });
  tone({ freq: 160, duration: 0.7, type: 'sawtooth', gain: 0.32, when: 0.84 });
}

/** Rising chime when a player is SOLD. */
export function playSold() {
  [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.18, gain: 0.22, when: i * 0.12 }));
}

/** Low double-tone when a player goes UNSOLD. */
export function playUnsold() {
  tone({ freq: 330, duration: 0.2, gain: 0.2, when: 0 });
  tone({ freq: 247, duration: 0.35, gain: 0.2, when: 0.22 });
}

/** Short "next player" cue. */
export function playStart() {
  tone({ freq: 660, duration: 0.1, gain: 0.18, when: 0 });
  tone({ freq: 990, duration: 0.14, gain: 0.18, when: 0.12 });
}

// Unlock on the first user gesture anywhere in the page.
if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
}
