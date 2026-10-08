import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Spinner from '../components/Spinner.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import { playEvent, setCustomSoundUrls } from '../utils/sound.js';
import { auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr } from '../utils/format.js';

/**
 * Public, read-only big-screen view for the audience / projector.
 * No login needed; it only consumes public GET endpoints and Socket.IO broadcasts.
 */
export default function LiveDisplayPage() {
  const [state, setState] = useState(null);
  const [banner, setBanner] = useState(null);

  const load = useCallback(() => auctionApi.current().then(setState).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const prevAuctionRef = useRef(null);
  useEffect(() => { if (state?.settings?.sounds) setCustomSoundUrls(state.settings.sounds); }, [state?.settings?.sounds]);

  const { connected, polling } = useAuctionSocket(
    async (event, payload) => {
      if (payload?.state) setState(payload.state);
      if (event === 'auction:started') playEvent('start');
      if (event === 'auction:sold') {
        playEvent('sold');
        setBanner({ type: 'sold', ...payload.sale });
        setTimeout(() => setBanner(null), 5000);
      }
      if (event === 'auction:unsold') {
        playEvent('unsold');
        setBanner({ type: 'unsold', player: payload.player?.name });
        setTimeout(() => setBanner(null), 3500);
      }
      // Polling mode: detect that the previous player left the block and look up the result.
      if (event === 'poll') {
        const prev = prevAuctionRef.current;
        const now = payload.state?.auction;
        prevAuctionRef.current = now ? { id: now._id, name: now.player?.name } : null;
        if (prev && (!now || now._id !== prev.id)) {
          try {
            const h = await auctionApi.history({ limit: 1 });
            const last = h.items?.[0];
            if (last && last._id === prev.id) {
              if (last.status === 'SOLD') { playEvent('sold'); setBanner({ type: 'sold', player: last.player?.name, team: last.winningTeam?.name, amount: last.finalBid }); }
              else if (last.status === 'UNSOLD') { playEvent('unsold'); setBanner({ type: 'unsold', player: last.player?.name }); }
              if (now) playEvent('start');
              setTimeout(() => setBanner(null), 4500);
            }
          } catch (e) { /* ignore */ }
        }
      }
    },
    { poll: true, interval: 2500 }
  );

  if (!state) return <Spinner full />;
  const { auction, settings, stats, roundConfig, serverTime, bids = [] } = state;
  const hasBids = !!auction && auction.bidCount > 0;
  const player = auction?.player;

  return (
    <div className="live-page">
      <div className="auction-top">
        <div className="card title flex between">
          <div>
            <div className="small muted" style={{ letterSpacing: 3 }}>{settings.auctionName.toUpperCase()}</div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Round {stats.round}</h1>
          </div>
          <div className="stack gap-sm" style={{ alignItems: 'flex-end' }}>
            <span className="small muted flex gap-sm"><span className={`live-dot ${connected || polling ? 'on' : ''}`} />{connected || polling ? 'LIVE' : 'Reconnecting…'}</span>
            <SoundToggle />
          </div>
        </div>
        <div className="card kpi"><span className="label">Players Remaining</span><span className="value">{stats.playersRemaining}</span></div>
        <div className="card kpi tone-success"><span className="label">Total Sold</span><span className="value">{stats.totalSold}</span></div>
        <div className="card kpi tone-danger"><span className="label">Total Unsold</span><span className="value">{stats.totalUnsold}</span></div>
        <div className="card kpi tone-warning"><span className="label">Base Price</span><span className="value">{inr(roundConfig.basePrice)}</span></div>
      </div>

      {auction ? (
        <div className="auction-stage">
          <div className="card player-stage">
            <Avatar src={player.photo} name={player.name} size="huge" square />
            <div className="grow">
              <div className="flex gap-sm flex-wrap" style={{ marginBottom: '.5rem' }}>
                <span className="player-no" style={{ fontSize: '2.2rem' }}>#{player.playerNo ?? '-'}</span>
                <Badge status="LIVE">● ON THE BLOCK</Badge>
                {player.releaseCount > 0 && <Badge tone="warning">Re-Auction</Badge>}
              </div>
              <div className="name">{player.name}</div>
              <div className="meta">
                <span className="chip">{player.playerType}</span>
                <span className="chip">🏏 {player.battingStyle}</span>
                <span className="chip">🎯 {player.bowlingStyle}</span>
                <span className="chip">👕 {player.tshirtSize}</span>
              </div>
              <div><span className="muted">Base Price </span><strong style={{ fontSize: '2rem', color: '#86efac' }}>{inr(auction.basePrice)}</strong></div>
            </div>
          </div>
          <div className="card bid-box">
            {auction.timerEndsAt && (
              <div className="flex" style={{ justifyContent: 'center' }}>
                <CountdownTimer endsAt={auction.timerEndsAt} serverTime={serverTime} totalSeconds={auction.timerSeconds} />
              </div>
            )}
            <div className="muted" style={{ letterSpacing: 3 }}>{hasBids ? 'CURRENT BID' : 'BASE PRICE'}</div>
            <div className="current">{inr(hasBids ? auction.currentBid : auction.basePrice)}</div>
            <div className="leading-team" style={{ fontSize: '2rem' }}>{hasBids ? `🏆 ${auction.highestBidder?.name}` : '🔨 Waiting for the first bid…'}</div>
            {bids.length > 0 && (
              <ul className="bid-ladder big">
                {bids.slice(0, 6).map((b) => (
                  <li key={b._id}>
                    <span><span className="color-dot" style={{ background: b.team?.color, marginRight: 8 }} />{b.team?.name || b.bidderName}</span>
                    <span className="raise">{b.raise > 0 ? `+${inr(b.raise)}` : 'Base'}</span>
                    <span className="total">{inr(b.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '3rem' }}>🏏</div>
          <h2>Next player coming up…</h2>
          <p className="muted">{stats.playersRemaining} players remaining in Round {stats.round}</p>
        </div>
      )}


      {banner && (
        <div className="sold-banner" onClick={() => setBanner(null)}>
          <div className={`inner ${banner.type}`}>
            <div className="stamp">{banner.type === 'sold' ? 'SOLD!' : 'UNSOLD'}</div>
            <h2 style={{ fontSize: '2rem' }}>{banner.player}</h2>
            {banner.type === 'sold' && (
              <>
                <div style={{ fontSize: '1.4rem' }}>to <strong>{banner.team}</strong></div>
                <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#86efac' }}>{inr(banner.amount)}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
