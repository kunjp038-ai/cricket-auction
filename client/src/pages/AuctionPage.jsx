import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { inr, fmtTime } from '../utils/format.js';

/**
 * Admin live auction console. Every action is a REST call; the server broadcasts the new
 * state through Socket.IO so this screen, other admin tabs and the public /live screen all
 * update at the same instant.
 */
export default function AuctionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [pool, setPool] = useState([]);
  const [flashTeam, setFlashTeam] = useState(null);

  const load = useCallback(() => auctionApi.current().then(setState).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const { connected, polling } = useAuctionSocket(
    (event, payload) => {
      if (payload?.state) setState(payload.state);
      if (event === 'auction:bid' && payload.bid) {
        setFlashTeam(payload.bid.teamId);
        setTimeout(() => setFlashTeam(null), 700);
      }
    },
    { poll: true, interval: 2500 }
  );

  const run = async (key, fn, { confirmOpts } = {}) => {
    if (confirmOpts && !(await confirm(confirmOpts))) return;
    setBusy(key);
    try {
      const res = await fn();
      if (res?.state) setState(res.state);
      if (res?.message) toast.success(res.message);
    } catch (e) {
      toast.error(e.message);
      load();
    } finally {
      setBusy('');
    }
  };

  const openPicker = async () => {
    try { const r = await auctionApi.pool(); setPool(r.pool); setPickOpen(true); } catch (e) { toast.error(e.message); }
  };

  if (!state) return <Spinner full />;
  const { auction, teams, settings, stats, nextBidAmount } = state;
  const player = auction?.player;
  const highestId = auction?.highestBidder?._id;

  const bidReason = (team) => {
    if (!auction) return 'No live auction';
    if (team._id === highestId) return 'Highest bidder';
    if ((team.players?.length || 0) >= team.maxPlayers) return 'Squad full';
    if (auction.previousTeam && auction.previousTeam._id === team._id && !settings.allowPreviousTeamRebid) return 'Previous team (re-bid off)';
    if (nextBidAmount > team.remainingBudget) return 'Insufficient budget';
    if (settings.maxBid > 0 && nextBidAmount > settings.maxBid) return 'Max bid reached';
    return null;
  };

  return (
    <>
      {/* Top strip */}
      <div className="auction-top">
        <div className="card title flex between">
          <div>
            <div className="small muted" style={{ letterSpacing: 2 }}>{settings.auctionName.toUpperCase()}</div>
            <h1 style={{ margin: 0 }}>Round {stats.round}</h1>
          </div>
          <span className="small muted flex gap-sm"><span className={`live-dot ${connected || polling ? 'on' : ''}`} />{connected ? 'Realtime on' : polling ? 'Live (polling)' : 'Reconnecting…'}</span>
        </div>
        <div className="card kpi"><span className="label">Players Remaining</span><span className="value">{stats.playersRemaining}</span></div>
        <div className="card kpi tone-success"><span className="label">Total Sold</span><span className="value">{stats.totalSold}</span></div>
        <div className="card kpi tone-danger"><span className="label">Total Unsold</span><span className="value">{stats.totalUnsold}</span></div>
        <div className="card kpi tone-warning"><span className="label">Bid Increment</span><span className="value">{inr(settings.bidIncrement)}</span></div>
      </div>

      {/* Stage */}
      {!auction ? (
        <div className="card mb">
          <EmptyState icon="🔨" title="No player on the block">
            <p className="muted">{stats.playersRemaining > 0 ? `${stats.playersRemaining} players are waiting in the pool for Round ${stats.round}.` : 'The pool for this round is empty. Start a re-auction round to bring back unsold players.'}</p>
            <div className="flex flex-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" disabled={busy || stats.playersRemaining === 0} onClick={() => run('start', () => auctionApi.start())}>▶ Start Auction (next in pool)</button>
              <button className="btn btn-ghost btn-lg" disabled={busy || stats.playersRemaining === 0} onClick={openPicker}>Pick a specific player</button>
              {stats.playersRemaining === 0 && stats.totalUnsold > 0 && (
                <button className="btn btn-accent btn-lg" disabled={busy} onClick={() => run('reauction', () => auctionApi.reauction(true), { confirmOpts: { title: 'Start re-auction round?', message: `Round ${stats.round} will close and ${stats.totalUnsold} unsold players move into Round ${stats.round + 1}.`, confirmText: 'Start next round', tone: 'accent' } })}>🔁 Start Re-Auction Round</button>
              )}
            </div>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="auction-stage">
            <div className="card player-stage">
              <Avatar src={player.photo} name={player.name} size="xl" />
              <div className="grow">
                <div className="flex gap-sm flex-wrap">
                  <Badge status="LIVE">● LIVE</Badge>
                  {player.releaseCount > 0 && <Badge tone="warning">Re-Auction · previously {auction.previousTeam?.name || 'owned'}</Badge>}
                </div>
                <div className="name">{player.name}</div>
                <div className="meta">
                  <span className="chip">{player.playerType}</span>
                  <span className="chip">🏏 {player.battingStyle}</span>
                  <span className="chip">🎯 {player.bowlingStyle}</span>
                  <span className="chip">👕 {player.tshirtSize}</span>
                </div>
                <div className="flex flex-wrap" style={{ gap: '1.5rem' }}>
                  <div><div className="small muted">Base Price</div><strong style={{ fontSize: '1.3rem' }}>{inr(auction.basePrice)}</strong></div>
                  <div><div className="small muted">Started</div><strong style={{ fontSize: '1.3rem' }}>{fmtTime(auction.startedAt)}</strong></div>
                </div>
              </div>
            </div>

            <div className="card bid-box">
              <div className="small muted" style={{ letterSpacing: 2 }}>CURRENT BID</div>
              <div className="current">{auction.bidCount > 0 ? inr(auction.currentBid) : '—'}</div>
              <div className="bidder">{auction.highestBidder ? `🏆 ${auction.highestBidder.name}` : 'No bids yet'}</div>
              <div className="next">Next bid: <strong>{inr(nextBidAmount)}</strong>{settings.maxBid > 0 && ` · max ${inr(settings.maxBid)}`}</div>
            </div>
          </div>

          {/* Team bid buttons */}
          <h2 style={{ marginBottom: '.6rem' }}>Teams</h2>
          <div className="team-bid-grid">
            {teams.map((t) => {
              const reason = bidReason(t);
              return (
                <div key={t._id} className={flashTeam === t._id ? 'flash' : ''} style={{ borderRadius: 14 }}>
                  <TeamCard
                    team={t}
                    highest={t._id === highestId}
                    onBid={() => run(`bid-${t._id}`, () => auctionApi.bid(auction._id, t._id))}
                    bidDisabled={!!busy || !!reason}
                    bidLabel={reason ? reason : `BID ${inr(nextBidAmount)}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="action-bar">
            <button
              className="btn btn-primary btn-lg"
              disabled={!!busy || !auction.highestBidder}
              onClick={() => run('sold', () => auctionApi.sold(auction._id), { confirmOpts: { title: 'Confirm SOLD', message: `Sell ${player.name} to ${auction.highestBidder?.name} for ${inr(auction.currentBid)}? The amount is deducted from the team budget now.`, confirmText: 'SOLD!', tone: 'primary' } })}
            >
              ✅ SOLD {auction.highestBidder ? `→ ${auction.highestBidder.name}` : ''}
            </button>
            <button
              className="btn btn-danger btn-lg"
              disabled={!!busy}
              onClick={() => run('unsold', () => auctionApi.unsold(auction._id), { confirmOpts: { title: 'Mark UNSOLD', message: `${player.name} will be marked UNSOLD${auction.bidCount > 0 ? ' even though there are bids' : ''}. The player can come back in a re-auction round.`, confirmText: 'UNSOLD', tone: 'danger' } })}
            >
              ❌ UNSOLD
            </button>
            <button
              className="btn btn-info btn-lg"
              disabled={!!busy}
              onClick={() => {
                if (auction.bidCount > 0) {
                  toast.warning('This player has bids. Mark SOLD or UNSOLD before moving to the next player.');
                  return;
                }
                run('next', () => auctionApi.next(), { confirmOpts: { title: 'Skip to next player?', message: `${player.name} has no bids and will be marked UNSOLD.`, confirmText: 'Next player', tone: 'info' } });
              }}
            >
              ⏭ NEXT PLAYER
            </button>
            <button className="btn btn-ghost btn-lg" disabled={!!busy} onClick={() => run('cancel', () => auctionApi.cancel(auction._id), { confirmOpts: { title: 'Cancel this auction?', message: 'The player returns to the pool with no result recorded.', confirmText: 'Cancel auction', tone: 'danger' } })}>
              ↩ Cancel
            </button>
          </div>
        </>
      )}

      {!auction && teams.length > 0 && (
        <>
          <h2 style={{ marginBottom: '.6rem' }}>Teams</h2>
          <div className="team-bid-grid">{teams.map((t) => <TeamCard key={t._id} team={t} onClick={() => navigate(`/teams/${t._id}`)} />)}</div>
        </>
      )}

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Pick a player to auction" size="lg">
        {pool.length === 0 ? <p className="muted">Pool is empty.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Player</th><th>Type</th><th>Status</th><th className="num">Base</th><th /></tr></thead>
              <tbody>
                {pool.map((p) => (
                  <tr key={p._id}>
                    <td><div className="flex"><Avatar src={p.photo} name={p.name} size="sm" /><strong>{p.name}</strong></div></td>
                    <td>{p.playerType}</td><td><Badge status={p.status} /></td><td className="num">{inr(p.basePrice)}</td>
                    <td className="text-right"><button className="btn btn-primary btn-sm" onClick={() => { setPickOpen(false); run('start', () => auctionApi.start(p._id)); }}>Auction</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
