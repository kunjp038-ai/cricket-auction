import { useEffect, useState } from 'react';

/** "Next player in 5…4…3" shown during the rest period after SOLD / UNSOLD. */
export default function NextPlayerCountdown({ nextPlayerAt, serverTime, big = false, onSkip }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  if (!nextPlayerAt) return null;
  const offset = serverTime ? Date.now() - new Date(serverTime).getTime() : 0;
  const remaining = Math.max(0, Math.ceil((new Date(nextPlayerAt).getTime() - (now - offset)) / 1000));
  return (
    <div className={`card text-center next-countdown ${big ? 'big' : ''}`}>
      <div className="small muted" style={{ letterSpacing: 3 }}>GET READY</div>
      <div className="num">{remaining > 0 ? remaining : '…'}</div>
      <div className="muted">{remaining > 0 ? 'Next player coming up' : 'Bringing the next player…'}</div>
      {onSkip && remaining > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '.6rem' }} onClick={onSkip}>Start now ▶</button>
      )}
    </div>
  );
}
