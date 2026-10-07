import { useEffect, useState } from 'react';

/**
 * Countdown to `endsAt` (ISO date from the server). `serverTime` (also from the server)
 * corrects for clock differences between the server and this device.
 */
export default function CountdownTimer({ endsAt, serverTime, big = false, label = 'TIME LEFT' }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!endsAt) return null;
  const offset = serverTime ? Date.now() - new Date(serverTime).getTime() : 0;
  const remainingMs = new Date(endsAt).getTime() - (now - offset);
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
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
