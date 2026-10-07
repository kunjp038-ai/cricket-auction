import { useEffect, useRef, useState } from 'react';
import { startCountdown, countdownTick, stopCountdown, playEvent } from '../utils/sound.js';

/**
 * Classic seconds countdown: a big number inside a ring that empties as time runs out.
 * `endsAt` / `serverTime` come from the server (serverTime corrects device clock drift).
 * Sound: clock tick-tock every second (or custom music), alarm bell at zero.
 */
export default function CountdownTimer({ endsAt, serverTime, totalSeconds = 0, big = false, label = 'SECONDS', sound = true }) {
  const [now, setNow] = useState(Date.now());
  const lastSecondRef = useRef(null);
  const endsAtRef = useRef(endsAt);
  const startedSoundRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => { clearInterval(id); stopCountdown(); };
  }, []);

  // A new deadline (new player or timer restart) resets the sound state.
  useEffect(() => {
    if (endsAtRef.current !== endsAt) {
      endsAtRef.current = endsAt;
      lastSecondRef.current = null;
      startedSoundRef.current = false;
      stopCountdown();
    }
  }, [endsAt]);

  const offset = serverTime ? Date.now() - new Date(serverTime).getTime() : 0;
  const remainingMs = endsAt ? new Date(endsAt).getTime() - (now - offset) : 0;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const total = Math.max(totalSeconds || 0, remaining, 1);

  useEffect(() => {
    if (!endsAt || !sound) return;
    const prev = lastSecondRef.current;
    if (prev === remaining) return;
    lastSecondRef.current = remaining;
    if (remaining <= 0) {
      if (prev !== null && prev > 0) { stopCountdown(); playEvent('timeUp'); }
      return;
    }
    if (!startedSoundRef.current) {
      startedSoundRef.current = true;
      startCountdown().then(() => countdownTick(remaining));
      return;
    }
    countdownTick(remaining);
  }, [remaining, endsAt, sound]);

  if (!endsAt) return null;
  const over = remaining <= 0;
  const cls = over ? 'over' : remaining <= 5 ? 'danger' : remaining <= 10 ? 'warn' : '';

  // Ring geometry
  const size = big ? 260 : 150;
  const stroke = big ? 14 : 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, remainingMs / (total * 1000)));
  const dash = circ * frac;

  return (
    <div className={`timer-ring ${cls} ${big ? 'big' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-label">{over ? 'TIME UP' : label}</span>
        <span className="ring-num">{over ? '0' : remaining}</span>
      </div>
    </div>
  );
}
