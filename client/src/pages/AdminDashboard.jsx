import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KpiCard from '../components/KpiCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import { dashboardApi, auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { inr, fmtDate } from '../utils/format.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => dashboardApi.admin().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  const startAuction = async () => {
    try {
      await auctionApi.start();
      navigate('/auction');
    } catch (e) {
      if (e.status === 409) navigate('/auction');
      else toast.error(e.message);
    }
  };

  const nextPlayer = async () => {
    try {
      const r = await auctionApi.next();
      toast.info(r.message);
      navigate('/auction');
    } catch (e) { toast.error(e.message); }
  };

  const reauction = async () => {
    const ok = await confirm({
      title: 'Start a re-auction round?',
      message: 'This closes the current round and moves every UNSOLD player (plus released players) into the next round\'s pool.',
      confirmText: 'Start next round', tone: 'accent',
    });
    if (!ok) return;
    try {
      const r = await auctionApi.reauction(true);
      toast.success(r.message);
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (error) return <div className="card error-text">{error}</div>;
  if (!data) return <Spinner full />;
  const { kpis, liveAuction, recentSales, teams } = data;

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        subtitle={`${data.settings.auctionName} · Round ${kpis.currentRound}`}
        actions={
          liveAuction ? (
            <button className="btn btn-accent" onClick={() => navigate('/auction')}>
              <span className="live-dot" /> Live: {liveAuction.player?.name} →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={startAuction}>🔨 Start Auction</button>
          )
        }
      />

      <div className="grid grid-4 mb">
        <KpiCard label="Total Players" value={kpis.totalPlayers} icon="🏏" onClick={() => navigate('/players')} />
        <KpiCard label="Available" value={kpis.availablePlayers} icon="🟢" tone="info" onClick={() => navigate('/players?status=Available')} />
        <KpiCard label="Sold" value={kpis.soldPlayers} icon="✅" tone="success" onClick={() => navigate('/players?status=Sold')} />
        <KpiCard label="Unsold" value={kpis.unsoldPlayers} icon="❌" tone="danger" onClick={() => navigate('/players?status=Unsold')} />
        <KpiCard label="Released" value={kpis.releasedPlayers} icon="♻️" tone="warning" onClick={() => navigate('/pool?tab=released')} />
        <KpiCard label="Total Teams" value={kpis.totalTeams} icon="🛡️" onClick={() => navigate('/teams')} />
        <KpiCard label="Total Auction Amount" value={inr(kpis.totalAuctionAmount)} icon="💰" tone="success" />
        <KpiCard label="Current Round" value={kpis.currentRound} icon="🔁" onClick={() => navigate('/rounds')} />
      </div>

      <div className="card mb">
        <div className="card-title"><h2>Quick Actions</h2></div>
        <div className="quick-actions">
          <button className="btn" onClick={() => navigate('/players/new')}>➕ Add Player</button>
          <button className="btn" onClick={() => navigate('/teams/new')}>➕ Add Team</button>
          <button className="btn btn-primary" onClick={startAuction}>🔨 Start Auction</button>
          <button className="btn" onClick={nextPlayer}>⏭ Next Player</button>
          <button className="btn" onClick={() => navigate('/pool?tab=unsold')}>❌ View Unsold</button>
          <button className="btn" onClick={() => navigate('/pool?tab=released')}>♻️ View Released</button>
          <button className="btn btn-accent" onClick={reauction}>🔁 Start Re-Auction</button>
          <button className="btn" onClick={() => navigate('/history')}>📜 Auction History</button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h2>Teams</h2>
            <span className="small muted">Pool: {kpis.poolSize} players left</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
            {teams.map((t) => <TeamCard key={t._id} team={t} onClick={() => navigate(`/teams/${t._id}`)} />)}
            {teams.length === 0 && <p className="muted">No teams yet. Add your first team.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><h2>Recent Sales</h2></div>
          {recentSales.length === 0 && <p className="muted">No players sold yet.</p>}
          <div className="stack">
            {recentSales.map((s) => (
              <div key={s._id} className="flex row-click" onClick={() => navigate(`/players/${s.player?._id}`)}>
                <Avatar src={s.player?.photo} name={s.player?.name} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <strong>{s.player?.name}</strong>
                  <div className="small muted">→ {s.winningTeam?.name} · Round {s.round} · {fmtDate(s.completedAt)}</div>
                </div>
                <Badge tone="success">{inr(s.finalBid)}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
