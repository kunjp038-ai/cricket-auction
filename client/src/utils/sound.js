/**
 * Auction music & sound effects.
 *
 * Priority for every event:
 *   1. a music file chosen on THIS device (stored in the browser's IndexedDB)
 *   2. a music URL saved in Settings (shared by all screens)
 *   3. built-in music synthesised with the Web Audio API (no files needed)
 *
 * Events: countdown (last 10 s), timeUp, sold, unsold, start
 * Browsers only allow sound after a user gesture, so `unlockAudio()` runs on the first click.
 */
export const SOUND_EVENTS = [
  { key: 'countdown', label: 'Countdown (last 10 seconds)', hint: 'A ~10 second clip. Starts when 10 seconds are left, stops at zero or when the timer restarts.' },
  { key: 'timeUp', label: 'Time up', hint: 'Plays when the countdown reaches zero.' },
  { key: 'sold', label: 'SOLD', hint: 'Plays when a player is sold.' },
  { key: 'unsold', label: 'UNSOLD', hint: 'Plays when a player goes unsold.' },
  { key: 'start', label: 'Next player', hint: 'Plays when a new player comes on the block.' },
];

const KEY = 'auction_sound';
const VOL_KEY = 'auction_volume';
let ctx = null;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } })();
let volume = (() => { try { const v = parseFloat(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) ? v : 0.8; } catch (e) { return 0.8; } })();
let customUrls = {};
const objectUrls = {};
const active = {};
let synthCountdown = false;

/* ------------------------------------------------------------------ */
/* Enable / volume / unlock                                            */
/* ------------------------------------------------------------------ */
export function isSoundEnabled() { return enabled; }
export function setSoundEnabled(v) {
  enabled = Boolean(v);
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
  if (enabled) unlockAudio(); else stopAll();
}
export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.min(1, Math.max(0, Number(v) || 0));
  try { localStorage.setItem(VOL_KEY, String(volume)); } catch (e) { /* ignore */ }
  Object.values(active).forEach((a) => { a.volume = volume; });
}
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch (e) { return false; }
}
export function isAudioReady() { return Boolean(ctx && ctx.state === 'running'); }

/** URLs from Settings (shared across screens). */
export function setCustomSoundUrls(sounds) { customUrls = { ...(sounds || {}) }; }

/* ------------------------------------------------------------------ */
/* Device-local music files (IndexedDB)                                */
/* ------------------------------------------------------------------ */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open('auction-sounds', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    const store = tx.objectStore('files');
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveDeviceSound(name, file) {
  await idb('readwrite', (s) => s.put(file, name));
  if (objectUrls[name]) { URL.revokeObjectURL(objectUrls[name]); delete objectUrls[name]; }
}
export async function removeDeviceSound(name) {
  await idb('readwrite', (s) => s.delete(name));
  if (objectUrls[name]) { URL.revokeObjectURL(objectUrls[name]); delete objectUrls[name]; }
}
export async function getDeviceSoundInfo(name) {
  try { const f = await idb('readonly', (s) => s.get(name)); return f ? { name: f.name || 'file', size: f.size } : null; } catch (e) { return null; }
}
async function deviceSoundUrl(name) {
  if (objectUrls[name]) return objectUrls[name];
  try {
    const blob = await idb('readonly', (s) => s.get(name));
    if (!blob) return null;
    objectUrls[name] = URL.createObjectURL(blob);
    return objectUrls[name];
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/* File playback                                                       */
/* ------------------------------------------------------------------ */
async function resolveSource(name, overrideUrl) {
  if (overrideUrl) return overrideUrl;
  const dev = await deviceSoundUrl(name);
  if (dev) return dev;
  return customUrls[name] || null;
}
async function playFile(name, { loop = false, overrideUrl = null } = {}) {
  const src = await resolveSource(name, overrideUrl);
  if (!src) return false;
  stopFile(name);
  const audio = new Audio(src);
  audio.volume = volume;
  audio.loop = loop;
  active[name] = audio;
  try { await audio.play(); return true; } catch (e) { delete active[name]; return false; }
}
function stopFile(name) {
  const a = active[name];
  if (a) { a.pause(); a.currentTime = 0; delete active[name]; }
}
export function stopAll() { Object.keys(active).forEach(stopFile); synthCountdown = false; }

/* ------------------------------------------------------------------ */
/* Built-in music (Web Audio synthesis)                                */
/* ------------------------------------------------------------------ */
const g = (v) => v * volume;
function now() { return ctx ? ctx.currentTime : 0; }
function ready() { return enabled && ctx && ctx.state === 'running'; }

function voice({ freq, when = 0, dur = 0.3, type = 'sine', gain = 0.2, attack = 0.01, slideTo = null, filter = null, detune = 0 }) {
  const t0 = now() + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(g(gain), t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter, t0);
    f.Q.value = 1;
    osc.connect(f);
    node = f;
  }
  node.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
const pluck = (freq, when, dur = 0.35, gain = 0.22) => {
  voice({ freq, when, dur, type: 'triangle', gain, attack: 0.005 });
  voice({ freq: freq * 2, when, dur: dur * 0.6, type: 'sine', gain: gain * 0.35, attack: 0.005 });
};
const kick = (when, gain = 0.5) => voice({ freq: 150, slideTo: 40, when, dur: 0.25, type: 'sine', gain, attack: 0.002 });
const brass = (freq, when, dur, gain = 0.16) => {
  voice({ freq, when, dur, type: 'sawtooth', gain, attack: 0.04, filter: 1800 });
  voice({ freq, when, dur, type: 'sawtooth', gain: gain * 0.8, attack: 0.04, filter: 1800, detune: 8 });
  voice({ freq: freq / 2, when, dur, type: 'square', gain: gain * 0.35, attack: 0.04, filter: 900 });
};
const bell = (freq, when, dur = 1.2, gain = 0.18) => {
  voice({ freq, when, dur, type: 'sine', gain, attack: 0.005 });
  voice({ freq: freq * 2.76, when, dur: dur * 0.7, type: 'sine', gain: gain * 0.3, attack: 0.005 });
  voice({ freq: freq * 5.4, when, dur: dur * 0.4, type: 'sine', gain: gain * 0.12, attack: 0.005 });
};

/** One step of the built-in countdown riff: rises in pitch and urgency as time runs out. */
function synthCountdownStep(remaining) {
  const idx = Math.max(0, 10 - remaining); // 0 (10 s left) … 9 (1 s left)
  const scale = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3, 587.3, 659.3];
  const base = scale[idx];
  kick(0, 0.45);
  pluck(base, 0, 0.3);
  pluck(base * 1.5, 0.22, 0.25, 0.16);
  if (remaining <= 5) { kick(0.5, 0.4); pluck(base * 2, 0.5, 0.2, 0.18); }
  if (remaining <= 3) pluck(base * 2, 0.75, 0.15, 0.18);
}
function synthTimeUp() {
  // gong + descending brass
  bell(130.8, 0, 2.5, 0.35);
  bell(98, 0.05, 2.8, 0.25);
  brass(392, 0.3, 0.35, 0.14);
  brass(349.2, 0.65, 0.35, 0.14);
  brass(293.7, 1.0, 0.9, 0.16);
}
function synthSold() {
  // triumphant fanfare: G – C – E – G' then chord
  brass(392, 0, 0.18); brass(523.3, 0.18, 0.18); brass(659.3, 0.36, 0.18);
  brass(784, 0.54, 0.7, 0.2); brass(523.3, 0.54, 0.7, 0.12); brass(659.3, 0.54, 0.7, 0.12);
  bell(1046.5, 0.56, 1.6, 0.14);
  kick(0, 0.5); kick(0.54, 0.6);
}
function synthUnsold() {
  pluck(329.6, 0, 0.5, 0.2); pluck(293.7, 0.3, 0.5, 0.2); pluck(246.9, 0.6, 0.9, 0.22);
  voice({ freq: 123.5, when: 0.6, dur: 1.0, type: 'triangle', gain: 0.12, attack: 0.05 });
}
function synthStart() {
  bell(659.3, 0, 0.6, 0.16); bell(880, 0.12, 0.7, 0.16); bell(1318.5, 0.24, 1.0, 0.14);
}
const synth = { timeUp: synthTimeUp, sold: synthSold, unsold: synthUnsold, start: synthStart };

/* ------------------------------------------------------------------ */
/* Public API used by the screens                                      */
/* ------------------------------------------------------------------ */
export async function playEvent(name) {
  if (!enabled) return;
  if (name === 'timeUp') stopCountdown();
  const played = await playFile(name);
  if (!played && ready() && synth[name]) synth[name]();
}

/** Called when 10 seconds remain. */
export async function startCountdown() {
  if (!enabled) return;
  const played = await playFile('countdown');
  synthCountdown = !played;
}
/** Called every second while the countdown runs (remaining 10 … 1). */
export function countdownTick(remaining) {
  if (!enabled || !synthCountdown || !ready()) return;
  synthCountdownStep(remaining);
}
export function stopCountdown() {
  stopFile('countdown');
  synthCountdown = false;
}

/** Settings page preview: plays the given URL, a device file, or the built-in music. */
export async function previewSound(name, url) {
  unlockAudio();
  stopAll();
  const played = await playFile(name, { overrideUrl: url || null });
  if (played) return 'file';
  if (!ready()) return 'blocked';
  if (name === 'countdown') {
    let r = 10;
    const id = setInterval(() => { synthCountdownStep(r); r -= 1; if (r < 1) { clearInterval(id); setTimeout(synthTimeUp, 1000); } }, 1000);
    synthCountdownStep(r); r -= 1;
  } else if (synth[name]) synth[name]();
  return 'builtin';
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
