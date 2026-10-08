import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import { playEvent, setCustomSoundUrls } from '../utils/sound.js';
import { auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { inr } from '../utils/format.js';

/**
 * Admin live auction console.
 * Teams call their raises in the room; the admin presses that team's +500 / +1000 button.
 * The running total, leading team and every bid are shown here and on the public /live screen.
 * SOLD sells the player to the leading team at the current total.
 */
export default function AuctionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [pool, setPool] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTeam, setManualTeam] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  const load = useCallback(() => auctionApi.current().then(setState).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const { connected, polling } = useAuctionSocket(
    (event, payload) => {
      if (payload?.state) setState(payload.state);
      if (event === 'auction:sold') playEvent('sold');
      if (event === 'auction:unsold') playEvent('unsold');
      if (event === 'auction:started') playEvent('start');
    },
    { poll: true, interval: 2500 }
  );

  // Music URLs from Settings.
  useEffect(() => { if (state?.settings?.sounds) setCustomSoundUrls(state.settings.sounds); }, [state?.settings?.sounds]);

  const auctionId = state?.auction?._id;
  useEffect(() => { setManualOpen(false); setManualTeam(''); setManualAmount(''); }, [auctionId]);

  const run = async (key, fn, { confirmOpts, quiet } = {}) => {
    if (confirmOpts && !(await confirm(confirmOpts))) return;
    setBusy(key);
    try {
      const res = await fn();
      if (res?.state) setState(res.state);
      if (res?.message && !quiet) toast.success(res.message);
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
  const { auction, teams, settings, stats, roundConfig, serverTime, bids = [] } = state;
  const player = auction?.player;
  const inc1 = settings.bidIncrement || 500;
  const inc2 = settings.bidIncrement2 || 1000;
  const hasBids = !!auction && auction.bidCount > 0;
  const total = auction ? (hasBids ? auction.currentBid : auction.basePrice) : 0;
  const leaderId = auction?.highestBidder?._id;
  const leader = teams.find((t) => t._id === leaderId);

  /** Amount the team would be at after this raise. */
  const amountAfter = (raise) => (hasBids ? auction.currentBid : auction.basePrice) + raise;

  const teamBlock = (team) => {
    if (!auction) return null;
    if ((team.players?.length || 0) >= team.maxPlayers) return 'Squad full';
    if (auction.previousTeam && auction.previousTeam._id === team._id && !settings.allowPreviousTeamRebid) return 'Previous team (re-bid off)';
    return null;
  };
  const raiseBlock = (team, raise) => {
    const amt = amountAfter(raise);
    if (team._id === leaderId) return 'Leading';
    if (settings.maxBid > 0 && amt > settings.maxBid) return 'Over max';
    if (amt > team.remainingBudget) return 'No budget';
    return null;
  };

  const bid = (team, raise) => run(`bid-${team._id}`, () => auctionApi.bid(auction._id, team._id, raise), { quiet: true });

  const sellToLeader = () => run('sold', () => auctionApi.sold(auction._id));

  const manualTeamObj = teams.find((t) => t._id === manualTeam);
  const manualAmt = Number(manualAmount);
  const manualErr = !manualTeamObj ? 'Select a team'
    : !manualAmt || manualAmt < auction?.basePrice ? `Minimum ${inr(auction?.basePrice)}`
    : manualAmt > manualTeamObj.remainingBudget ? `${manualTeamObj.name} has only ${inr(manualTeamObj.remainingBudget)}`
    : null;

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
          <div className="stack gap-sm" style={{ alignItems: 'flex-end' }}>
            <span className="small muted flex gap-sm"><span className={`live-dot ${connected || polling ? 'on' : ''}`} />{connected ? 'Realtime on' : polling ? 'Live (polling)' : 'Reconnecting…'}</span>
            <SoundToggle />
          </div>
        </div>
        <div className="card kpi"><span className="label">Players Remaining</span><span className="value">{stats.playersRemaining}</span></div>
        <div className="card kpi tone-success"><span className="label">Total Sold</span><span className="value">{stats.totalSold}</span></div>
        <div className="card kpi tone-danger"><span className="label">Total Unsold</span><span className="value">{stats.totalUnsold}</span></div>
        <div className="card kpi tone-warning"><span className="label">Bid Buttons</span><span className="value">+{inc1} / +{inc2}</span></div>
      </div>

      {!auction ? (
        <div className="card mb">
          <EmptyState icon="🔨" title="No player on the block">
            <p className="muted">{stats.playersRemaining > 0 ? `${stats.playersRemaining} players are waiting in the pool for Round ${stats.round} (base price ${inr(roundConfig.basePrice)}).` : 'The pool for this round is empty. Start a re-auction round to bring back unsold players.'}</p>
            <div className="flex flex-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" disabled={busy || stats.playersRemaining === 0} onClick={() => run('start', () => auctionApi.start())}>▶ Start Auction ({settings.auctionOrder === 'number' ? 'next by number' : 'random player'})</button>
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
                  <div><div className="small muted">Base Price</div><strong style={{ fontSize: '1.6rem', color: '#86efac' }}>{inr(auction.basePrice)}</strong></div>
                  {auction.timerEndsAt && (
                    <div className="flex gap-sm">
                      <CountdownTimer endsAt={auction.timerEndsAt} serverTime={serverTime} totalSeconds={auction.timerSeconds} />
                      <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run('timer', () => auctionApi.resetTimer(auction._id), { quiet: true })} title="Restart timer (also restarts on every bid)">↻ Restart</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Running total + bid ladder + SOLD */}
            <div className="card bid-box">
              <div className="small muted" style={{ letterSpacing: 2 }}>{hasBids ? 'CURRENT BID' : 'STARTS AT BASE PRICE'}</div>
              <div className="current">{inr(total)}</div>
              <div className="leading-team">{leader ? `🏆 ${leader.name}` : 'No bids yet'}</div>
              {bids.length > 0 && (
                <ul className="bid-ladder">
                  {bids.map((b) => (
                    <li key={b._id}>
                      <span><span className="color-dot" style={{ background: b.team?.color, marginRight: 6 }} />{b.team?.name || b.bidderName}</span>
                      <span className="raise">{b.raise > 0 ? `+${inr(b.raise)}` : 'Base'}</span>
                      <span className="total">{inr(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn btn-primary btn-lg btn-block" disabled={!!busy || !hasBids} onClick={sellToLeader}>
                {busy === 'sold' ? 'Saving…' : hasBids ? <>✅ SOLD → {leader?.name || auction.highestBidder?.name} for {inr(auction.currentBid)}</> : '✅ SOLD (place a bid first)'}
              </button>
              <div className="flex" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={!!busy || !hasBids} onClick={() => run('undo', () => auctionApi.undoBid(auction._id))}>↶ Undo last bid</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setManualOpen((o) => !o)}>✎ Manual price</button>
              </div>
              {manualOpen && (
                <div className="stack" style={{ textAlign: 'left' }}>
                  <select value={manualTeam} onChange={(e) => setManualTeam(e.target.value)}>
                    <option value="">— Team —</option>
                    {teams.map((t) => <option key={t._id} value={t._id}>{t.name} · {inr(t.remainingBudget)} left</option>)}
                  </select>
                  <input type="number" min={auction.basePrice} step="any" placeholder="Sold price" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
                  {manualErr && manualTeam && <span className="error-text">{manualErr}</span>}
                  <button className="btn btn-accent" disabled={!!busy || !!manualErr} onClick={() => run('sold', () => auctionApi.sold(auction._id, { teamId: manualTeam, amount: manualAmt }))}>SOLD at manual price</button>
                </div>
              )}
              {settings.autoNextPlayer && <span className="help text-center">Next player comes up automatically after SOLD / UNSOLD.</span>}
            </div>
          </div>

          {/* Team bid buttons */}
          <h2 style={{ marginBottom: '.6rem' }}>Teams <span className="small muted">(press the team that calls a bid)</span></h2>
          <div className="team-bid-grid">
            {teams.map((t) => {
              const blocked = teamBlock(t);
              const b1 = raiseBlock(t, inc1);
              const b2 = raiseBlock(t, inc2);
              const b0 = !hasBids ? raiseBlock(t, 0) : 'n/a';
              return (
                <TeamCard
                  key={t._id}
                  team={t}
                  highest={t._id === leaderId}
                  footer={blocked ? <span className="badge badge-danger">{blocked}</span> : (
                    <div className="bid-btns">
                      {!hasBids && (
                        <button className="btn btn-info full" disabled={!!busy || !!b0} onClick={() => bid(t, 0)} title={b0 || ''}>
                          Base {inr(auction.basePrice)}
                        </button>
                      )}
                      <button className="btn btn-primary" disabled={!!busy || !!b1} onClick={() => bid(t, inc1)} title={b1 || `→ ${inr(amountAfter(inc1))}`}>
                        +{inc1}
                      </button>
                      <button className="btn btn-accent" disabled={!!busy || !!b2} onClick={() => bid(t, inc2)} title={b2 || `→ ${inr(amountAfter(inc2))}`}>
                        +{inc2}
                      </button>
                      {t._id === leaderId ? <span className="small muted full text-center">Leading at {inr(auction.currentBid)}</span>
                        : (b1 && b1 !== 'Leading') ? <span className="small full text-center error-text">{b1}</span> : null}
                    </div>
                  )}
                />
              );
            })}
          </div>

          {/* Other actions */}
          <div className="action-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              className="btn btn-danger btn-lg"
              disabled={!!busy}
              onClick={() => run('unsold', () => auctionApi.unsold(auction._id), { confirmOpts: { title: 'Mark UNSOLD', message: `#${player.playerNo} ${player.name} will be marked UNSOLD${hasBids ? ' even though there are bids' : ''}. The player can come back in a re-auction round.`, confirmText: 'UNSOLD', tone: 'danger' } })}
            >
              ❌ UNSOLD
            </button>
            <button
              className="btn btn-info btn-lg"
              disabled={!!busy}
              onClick={() => {
                if (hasBids) { toast.warning('This player has bids. Press SOLD or UNSOLD first.'); return; }
                run('next', () => auctionApi.next(), { confirmOpts: { title: 'Skip to next player?', message: `${player.name} will be marked UNSOLD and the next player comes up.`, confirmText: 'Next player', tone: 'info' } });
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
