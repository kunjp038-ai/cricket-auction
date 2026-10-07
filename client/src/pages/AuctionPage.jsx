import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import { auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { inr } from '../utils/format.js';

/**
 * Admin live auction console.
 * Players come up in player-number order. Teams call their bids out loud; the admin
 * records the result (winning team + final price) and presses SOLD. The next player is
 * put on the block automatically (Settings → Auto next player).
 */
export default function AuctionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [pool, setPool] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(() => auctionApi.current().then(setState).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const { connected, polling } = useAuctionSocket(
    (event, payload) => { if (payload?.state) setState(payload.state); },
    { poll: true, interval: 2500 }
  );

  // Reset the sale form whenever a new player comes on the block.
  const auctionId = state?.auction?._id;
  useEffect(() => {
    setTeamId('');
    setAmount(state?.auction ? String(state.auction.basePrice) : '');
  }, [auctionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const { auction, teams, settings, stats, roundConfig, serverTime } = state;
  const player = auction?.player;
  const selectedTeam = teams.find((t) => t._id === teamId);
  const amt = Number(amount);

  const teamProblem = (team) => {
    if (!auction) return null;
    if ((team.players?.length || 0) >= team.maxPlayers) return 'Squad full';
    if (auction.previousTeam && auction.previousTeam._id === team._id && !settings.allowPreviousTeamRebid) return 'Previous team (re-bid off)';
    if (team.remainingBudget < auction.basePrice) return 'Cannot afford base price';
    return null;
  };

  const amountProblem = () => {
    if (!auction) return null;
    if (!amount || !Number.isFinite(amt) || amt <= 0) return 'Enter the sold price';
    if (amt < auction.basePrice) return `Minimum is the base price ${inr(auction.basePrice)}`;
    if (settings.maxBid > 0 && amt > settings.maxBid) return `Maximum bid is ${inr(settings.maxBid)}`;
    if (selectedTeam && amt > selectedTeam.remainingBudget) return `Insufficient budget: ${selectedTeam.name} has ${inr(selectedTeam.remainingBudget)} left`;
    return null;
  };
  const amountErr = amountProblem();
  const canSell = !!auction && !!selectedTeam && !teamProblem(selectedTeam) && !amountErr;

  // No confirmation on SOLD: the team + price were chosen explicitly, and speed matters live.
  const sell = () => run('sold', () => auctionApi.sold(auction._id, { teamId, amount: amt }));

  const step = settings.bidIncrement || 500;

  return (
    <>
      {/* Top strip */}
      <div className="auction-top">
        <div className="card title flex between">
          <div>
            <div className="small muted" style={{ letterSpacing: 2 }}>{settings.auctionName.toUpperCase()}</div>
            <h1 style={{ margin: 0 }}>Round {stats.round}</h1>
            <div className="small muted">Base {inr(roundConfig.basePrice)} · Timer {roundConfig.timerSeconds ? `${roundConfig.timerSeconds}s` : 'off'}</div>
          </div>
          <span className="small muted flex gap-sm"><span className={`live-dot ${connected || polling ? 'on' : ''}`} />{connected ? 'Realtime on' : polling ? 'Live (polling)' : 'Reconnecting…'}</span>
        </div>
        <div className="card kpi"><span className="label">Players Remaining</span><span className="value">{stats.playersRemaining}</span></div>
        <div className="card kpi tone-success"><span className="label">Total Sold</span><span className="value">{stats.totalSold}</span></div>
        <div className="card kpi tone-danger"><span className="label">Total Unsold</span><span className="value">{stats.totalUnsold}</span></div>
        <div className="card kpi tone-warning"><span className="label">Teams</span><span className="value">{teams.length}</span></div>
      </div>

      {!auction ? (
        <div className="card mb">
          <EmptyState icon="🔨" title="No player on the block">
            <p className="muted">{stats.playersRemaining > 0 ? `${stats.playersRemaining} players are waiting in the pool for Round ${stats.round} (base price ${inr(roundConfig.basePrice)}).` : 'The pool for this round is empty. Start a re-auction round to bring back unsold players.'}</p>
            <div className="flex flex-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" disabled={busy || stats.playersRemaining === 0} onClick={() => run('start', () => auctionApi.start())}>▶ Start Auction (next by number)</button>
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
            {/* Player details */}
            <div className="card player-stage">
              <Avatar src={player.photo} name={player.name} size="xxl" square />
              <div className="grow">
                <div className="flex gap-sm flex-wrap" style={{ marginBottom: '.4rem' }}>
                  <span className="player-no">#{player.playerNo ?? '-'}</span>
                  <Badge status="LIVE">● ON THE BLOCK</Badge>
                  {player.releaseCount > 0 && <Badge tone="warning">Re-Auction · previously {auction.previousTeam?.name || 'owned'}</Badge>}
                </div>
                <div className="name">{player.name}</div>
                <div className="meta">
                  <span className="chip">{player.playerType}</span>
                  <span className="chip">🏏 {player.battingStyle}</span>
                  <span className="chip">🎯 {player.bowlingStyle}</span>
                  <span className="chip">👕 {player.tshirtSize}</span>
                </div>
                <div className="flex flex-wrap" style={{ gap: '1.5rem', alignItems: 'flex-end' }}>
                  <div><div className="small muted">Base Price</div><strong style={{ fontSize: '1.8rem', color: '#86efac' }}>{inr(auction.basePrice)}</strong></div>
                  {auction.timerEndsAt && (
                    <div className="flex gap-sm">
                      <CountdownTimer endsAt={auction.timerEndsAt} serverTime={serverTime} />
                      <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run('timer', () => auctionApi.resetTimer(auction._id))} title="Restart timer">↻ Restart</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Record the result */}
            <div className="card bid-box" style={{ textAlign: 'left' }}>
              <div className="small muted" style={{ letterSpacing: 2 }}>RECORD RESULT</div>
              <div className="field">
                <label>Winning team</label>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">— Select team —</option>
                  {teams.map((t) => {
                    const prob = teamProblem(t);
                    return <option key={t._id} value={t._id} disabled={!!prob}>{t.name} · {inr(t.remainingBudget)} left{prob ? ` · ${prob}` : ''}</option>;
                  })}
                </select>
              </div>
              <div className="field">
                <label>Sold price (₹)</label>
                <div className="flex">
                  <button type="button" className="btn btn-ghost" onClick={() => setAmount(String(Math.max(auction.basePrice, amt - step)))}>−{step}</button>
                  <input type="number" min={auction.basePrice} step={step} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }} />
                  <button type="button" className="btn btn-ghost" onClick={() => setAmount(String((amt || auction.basePrice) + step))}>+{step}</button>
                </div>
                {amountErr ? <span className="error-text">{amountErr}</span> : <span className="help">{selectedTeam ? `${selectedTeam.name} will have ${inr(selectedTeam.remainingBudget - amt)} left` : 'Select the team that won the bid'}</span>}
              </div>
              <button className="btn btn-primary btn-lg btn-block" disabled={!!busy || !canSell} onClick={sell}>
                {busy === 'sold' ? 'Saving…' : <>✅ SOLD {selectedTeam ? `→ ${selectedTeam.name} for ${inr(amt || 0)}` : ''}</>}
              </button>
              {settings.autoNextPlayer && <span className="help text-center">Next player (#{'by number'}) comes up automatically after SOLD / UNSOLD.</span>}
            </div>
          </div>

          {/* Teams – click to select the winner */}
          <h2 style={{ marginBottom: '.6rem' }}>Teams <span className="small muted">(click a team to select it as the winner)</span></h2>
          <div className="team-bid-grid">
            {teams.map((t) => {
              const prob = teamProblem(t);
              return (
                <TeamCard
                  key={t._id}
                  team={t}
                  highest={t._id === teamId}
                  onClick={() => !prob && setTeamId(t._id)}
                  footer={prob ? <span className="badge badge-danger">{prob}</span> : null}
                />
              );
            })}
          </div>

          {/* Other actions */}
          <div className="action-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              className="btn btn-danger btn-lg"
              disabled={!!busy}
              onClick={() => run('unsold', () => auctionApi.unsold(auction._id), { confirmOpts: { title: 'Mark UNSOLD', message: `#${player.playerNo} ${player.name} will be marked UNSOLD. The player can come back in a re-auction round.`, confirmText: 'UNSOLD', tone: 'danger' } })}
            >
              ❌ UNSOLD
            </button>
            <button
              className="btn btn-info btn-lg"
              disabled={!!busy}
              onClick={() => run('next', () => auctionApi.next(), { confirmOpts: { title: 'Skip to next player?', message: `${player.name} will be marked UNSOLD and the next player comes up.`, confirmText: 'Next player', tone: 'info' } })}
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
              <thead><tr><th>No.</th><th>Player</th><th>Type</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pool.map((p) => (
                  <tr key={p._id}>
                    <td><span className="player-no sm">#{p.playerNo ?? '-'}</span></td>
                    <td><div className="flex"><Avatar src={p.photo} name={p.name} size="sm" /><strong>{p.name}</strong></div></td>
                    <td>{p.playerType}</td><td><Badge status={p.status} /></td>
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
