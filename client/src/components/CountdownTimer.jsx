import { useEffect, useRef, useState } from 'react';
import { startCountdown, countdownTick, stopCountdown, scheduleFinalAlert, cancelFinalAlert } from '../utils/sound.js';

/**
 * Classic seconds countdown: a big number inside a ring that empties as time runs out.
 * `endsAt` / `serverTime` come from the server. The server/device clock offset is captured
 * once per received state (not on every render) so the display runs smoothly between updates.
 * Sound: optional clock tick while counting; the last 5 seconds (beep per second + bell at
 * zero) are scheduled on the audio clock so they always fire on time.
 */
export default function CountdownTimer({ endsAt, serverTime, totalSeconds = 0, big = false, label = 'SECONDS', sound = true }) {
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);
  const lastServerTimeRef = useRef(null);
  const lastSecondRef = useRef(null);
  const endsAtRef = useRef(endsAt);
  const startedSoundRef = useRef(false);
  const alertScheduledRef = useRef(false);

  // Capture the clock offset when a NEW server timestamp arrives; ignore small network jitter.
  if (serverTime && serverTime !== lastServerTimeRef.current) {
    lastServerTimeRef.current = serverTime;
    const fresh = Date.now() - new Date(serverTime).getTime();
    if (offsetRef.current === 0 || Math.abs(fresh - offsetRef.current) > 1500) offsetRef.current = fresh;
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => { clearInterval(id); stopCountdown(); cancelFinalAlert(); };
  }, []);

  // A new deadline (new player or timer restart) resets sound state and cancels scheduled alerts.
  useEffect(() => {
    if (endsAtRef.current !== endsAt) {
      endsAtRef.current = endsAt;
      lastSecondRef.current = null;
      startedSoundRef.current = false;
      alertScheduledRef.current = false;
      stopCountdown();
      cancelFinalAlert();
    }
  }, [endsAt]);

  const remainingMs = endsAt ? new Date(endsAt).getTime() - (now - offsetRef.current) : 0;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const total = Math.max(totalSeconds || 0, remaining, 1);

  useEffect(() => {
    if (!endsAt || !sound) return;
    if (remainingMs <= 0) return;

    // Last 5 seconds: schedule beeps + bell precisely, once per deadline.
    if (remainingMs <= 5000 && !alertScheduledRef.current) {
      alertScheduledRef.current = true;
      scheduleFinalAlert(remainingMs);
      return;
    }

    const prev = lastSecondRef.current;
    if (prev === remaining) return;
    lastSecondRef.current = remaining;
    if (remaining > 5) {
      if (!startedSoundRef.current) {
        startedSoundRef.current = true;
        startCountdown().then(() => countdownTick(remaining));
      } else {
        countdownTick(remaining);
      }
    }
  }, [remaining, remainingMs, endsAt, sound]);

  if (!endsAt) return null;
  const over = remainingMs <= 0;
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
