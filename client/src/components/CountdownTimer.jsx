import { useEffect, useRef, useState } from 'react';
import { playTick, playUrgentTick, playBuzzer } from '../utils/sound.js';

/**
 * Countdown to `endsAt` (ISO date from the server). `serverTime` (also from the server)
 * corrects for clock differences between the server and this device.
 * Sounds: tick in the last 10 s (sharper in the last 5 s), buzzer at zero.
 */
export default function CountdownTimer({ endsAt, serverTime, big = false, label = 'TIME LEFT', sound = true }) {
  const [now, setNow] = useState(Date.now());
  const lastSecondRef = useRef(null);
  const endsAtRef = useRef(endsAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // A new deadline (new player or timer restart) resets the sound state.
  useEffect(() => {
    if (endsAtRef.current !== endsAt) {
      endsAtRef.current = endsAt;
      lastSecondRef.current = null;
    }
  }, [endsAt]);

  const offset = serverTime ? Date.now() - new Date(serverTime).getTime() : 0;
  const remainingMs = endsAt ? new Date(endsAt).getTime() - (now - offset) : 0;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (!endsAt || !sound) return;
    const prev = lastSecondRef.current;
    if (prev === remaining) return;
    lastSecondRef.current = remaining;
    // Only react to real second-by-second transitions, not to the first render of an old timer.
    if (prev === null) {
      if (remaining === 0) return; // already expired when we arrived: stay silent
      return;
    }
    if (remaining === 0) playBuzzer();
    else if (remaining <= 5) playUrgentTick();
    else if (remaining <= 10) playTick();
  }, [remaining, endsAt, sound]);

  if (!endsAt) return null;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const over = remaining <= 0;
  const cls = over ? 'over' : remaining <= 10 ? 'danger' : remaining <= 20 ? 'warn' : '';

  return (
    <div className={`timer ${cls} ${big ? 'big' : ''}`}>
      <span className="small muted" style={{ letterSpacing: 2 }}>{over ? 'TIME UP' : label}</span>
      <span className="time">{over ? '⏰ 00:00' : `${mm}:${ss}`}</span>
    </div>
  );
}
