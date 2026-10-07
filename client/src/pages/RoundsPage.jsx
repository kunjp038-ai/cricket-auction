import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Badge from '../components/Badge.jsx';
import Spinner from '../components/Spinner.jsx';
import { auctionApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr, fmtDate, pct } from '../utils/format.js';

export default function RoundsPage() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => auctionApi.rounds().then(setData).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  const reauction = async () => {
    const ok = await confirm({ title: `Close Round ${data.currentRound} and start Round ${data.currentRound + 1}?`, message: 'All unsold players move into the new round\'s pool.', confirmText: 'Start next round', tone: 'accent' });
    if (!ok) return;
    try { const r = await auctionApi.reauction(true); toast.success(r.message); load(); } catch (e) { toast.error(e.message); }
  };

  if (!data) return <Spinner full />;

  return (
    <>
      <PageHeader title="Auction Rounds" subtitle={`Currently in Round ${data.currentRound}`} actions={<button className="btn btn-accent" onClick={reauction}>🔁 Start Re-Auction Round</button>} />
      <div className="grid grid-3">
        {data.rounds.map((r) => (
          <div key={r.number} className={`card stack ${r.isCurrent ? 'tone-success' : ''}`} style={r.isCurrent ? { borderColor: 'rgba(34,197,94,.5)' } : undefined}>
            <div className="flex between">
              <h2 style={{ margin: 0 }}>Round {r.number}</h2>
              <Badge tone={r.isCurrent ? 'live' : 'neutral'}>{r.isCurrent ? 'Current' : 'Closed'}</Badge>
            </div>
            <div className="grid grid-3" style={{ gap: '.5rem' }}>
              <div><div className="small muted">Players</div><strong style={{ fontSize: '1.4rem' }}>{r.players}</strong></div>
              <div><div className="small muted">Sold</div><strong style={{ fontSize: '1.4rem', color: '#86efac' }}>{r.sold}</strong></div>
              <div><div className="small muted">Unsold</div><strong style={{ fontSize: '1.4rem', color: '#fca5a5' }}>{r.unsold}</strong></div>
            </div>
            <div className="bar"><span style={{ width: `${pct(r.sold, r.players)}%` }} /></div>
            <div className="flex between small muted">
              <span>{r.isCurrent ? `${r.remaining} remaining` : `${pct(r.sold, r.players)}% sold`}</span>
              <span>{inr(r.amount)} total</span>
            </div>
            <div className="small muted">Started {fmtDate(r.startedAt)}{r.closedAt && <> · Closed {fmtDate(r.closedAt)}</>}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/history?round=${r.number}`)}>View round history</button>
          </div>
        ))}
      </div>
    </>
  );
}
