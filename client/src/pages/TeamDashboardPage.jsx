import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import BudgetBar from '../components/BudgetBar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { teamsApi, playersApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr, fmtDate } from '../utils/format.js';

export default function TeamDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('squad');

  const load = useCallback(() => teamsApi.dashboard(id).then(setData).catch((e) => toast.error(e.message)), [id, toast]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  if (!data) return <Spinner full />;
  const { team, squad, stats, ledger, ledgerBalance, releasedHistory } = data;

  const release = async (p) => {
    const ok = await confirm({
      title: `Release ${p.name}?`,
      message: `Removes ${p.name} from ${team.name}, refunds ${inr(p.bidAmount)} and sends the player to RE-AUCTION. The sale record stays in history.`,
      confirmText: 'Release player', tone: 'accent',
    });
    if (!ok) return;
    try { const r = await playersApi.release(p._id); toast.success(r.message); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title={team.name}
        subtitle="Team dashboard"
        actions={<><Link to={`/teams/${id}/edit`} className="btn btn-ghost">✏️ Edit Team</Link><Link to="/teams" className="btn btn-ghost">← All teams</Link></>}
      />

      <div className="grid grid-3 mb">
        <div className="card flex" style={{ gap: '1.2rem', borderTop: `4px solid ${team.color}` }}>
          <Avatar src={team.logo} name={team.name} size="xl" square color={team.color} />
          <div className="stack gap-sm">
            <div><span className="small muted">Team</span><br /><strong style={{ fontSize: '1.2rem' }}>{team.name}</strong></div>
            <div><span className="small muted">Captain</span><br />
              {team.captain ? <span className="flex gap-sm"><Avatar src={team.captain.photo} name={team.captain.name} size="sm" /><strong>{team.captain.name}</strong></span> : <span className="muted">Not assigned · <Link to="/captains" style={{ textDecoration: 'underline' }}>assign</Link></span>}
            </div>
            <div><span className="small muted">Squad limits</span><br /><strong>{stats.minPlayers} – {stats.maxPlayers} players</strong></div>
          </div>
        </div>
        <div className="card stack">
          <h3>Budget</h3>
          <div className="grid grid-3" style={{ gap: '.5rem' }}>
            <div><div className="small muted">Total</div><strong className="mono">{inr(stats.totalBudget)}</strong></div>
            <div><div className="small muted">Used</div><strong className="mono" style={{ color: '#fca5a5' }}>{inr(stats.totalSpent)}</strong></div>
            <div><div className="small muted">Remaining</div><strong className="mono" style={{ color: '#86efac' }}>{inr(stats.remainingBudget)}</strong></div>
          </div>
          <BudgetBar total={stats.totalBudget} used={stats.totalSpent} />
          <div className="small muted">Ledger balance check: {inr(ledgerBalance)} {ledgerBalance === stats.remainingBudget ? '✓ matches' : '⚠ mismatch'}</div>
        </div>
        <div className="grid grid-2" style={{ gap: '.6rem' }}>
          <KpiCard label="Players" value={`${stats.totalPlayers}/${stats.maxPlayers}`} />
          <KpiCard label="Batsmen" value={stats.batsmen} />
          <KpiCard label="Bowlers" value={stats.bowlers} />
          <KpiCard label="All Rounders" value={stats.allRounders} />
          <KpiCard label="Wicket Keepers" value={stats.wicketKeepers} />
          <KpiCard label="Slots Left" value={stats.slotsLeft} tone={stats.slotsLeft === 0 ? 'danger' : ''} />
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'squad' ? 'active' : ''} onClick={() => setTab('squad')}>Squad ({squad.length})</button>
        <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>Transaction Ledger ({ledger.length})</button>
        <button className={tab === 'released' ? 'active' : ''} onClick={() => setTab('released')}>Released Players ({releasedHistory.length})</button>
      </div>

      {tab === 'squad' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Player</th><th>Type</th><th>Batting</th><th>Bowling</th><th>Round</th><th className="num">Bid Amount</th><th>Status</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {squad.length === 0 && <tr><td colSpan={8} className="muted text-center">No players bought yet.</td></tr>}
              {squad.map((p) => (
                <tr key={p._id}>
                  <td><div className="flex row-click" onClick={() => navigate(`/players/${p._id}`)}><Avatar src={p.photo} name={p.name} size="sm" /><strong>{p.name}</strong></div></td>
                  <td>{p.playerType}</td><td>{p.battingStyle}</td><td>{p.bowlingStyle}</td><td>{p.round}</td>
                  <td className="num">{inr(p.bidAmount)}</td>
                  <td><Badge tone="success">Active</Badge></td>
                  <td className="text-right"><button className="btn btn-accent btn-sm" onClick={() => release(p)}>Release</button></td>
                </tr>
              ))}
            </tbody>
            {squad.length > 0 && <tfoot><tr><th colSpan={5}>Total</th><th className="num">{inr(squad.reduce((s, p) => s + p.bidAmount, 0))}</th><th colSpan={2} /></tr></tfoot>}
          </table>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="card">
          <p className="small muted" style={{ marginTop: 0 }}>Every budget movement is recorded here. The team balance is always derived from this ledger, never from the player list alone.</p>
          <ul className="ledger" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ledger.map((t) => (
              <li key={t._id}>
                <span><strong>{t.description}</strong><div className="small muted">{t.type.replace('_', ' ')}{t.player ? ` · ${t.player.name}` : ''} · {fmtDate(t.createdAt)}</div></span>
                <span className={t.amount >= 0 ? 'credit' : 'debit'}>{t.amount >= 0 ? '+ ' : '- '}{inr(Math.abs(t.amount))}</span>
                <span className="small muted mono">Bal {inr(t.balanceAfter)}</span>
              </li>
            ))}
            <li><strong>Current Balance</strong><span className="credit">{inr(ledgerBalance)}</span><span /></li>
          </ul>
        </div>
      )}

      {tab === 'released' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Player</th><th>Round</th><th className="num">Paid</th><th>Bought</th><th>Released</th><th>Now</th></tr></thead>
            <tbody>
              {releasedHistory.length === 0 && <tr><td colSpan={6} className="muted text-center">No players released by this team.</td></tr>}
              {releasedHistory.map((a) => (
                <tr key={a._id}>
                  <td><div className="flex row-click" onClick={() => navigate(`/players/${a.player?._id}`)}><Avatar src={a.player?.photo} name={a.player?.name} size="sm" /><strong>{a.player?.name}</strong></div></td>
                  <td>{a.round}</td><td className="num">{inr(a.finalBid)}</td><td>{fmtDate(a.completedAt)}</td><td>{fmtDate(a.releasedAt)}</td>
                  <td><Badge status={a.player?.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
