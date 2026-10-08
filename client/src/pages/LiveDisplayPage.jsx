import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Spinner from '../components/Spinner.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import LiveSquads from '../components/LiveSquads.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import { playEvent, setCustomSoundUrls } from '../utils/sound.js';
import { auctionApi } from '../services/api.js';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr } from '../utils/format.js';

/**
 * Public, read-only big-screen view for the audience / projector.
 * No login needed; it only consumes public GET endpoints and Socket.IO broadcasts.
 */
export default function LiveDisplayPage({ initialTab = 'auction' }) {
  const [tab, setTab] = useState(initialTab);
  const [state, setState] = useState(null);
  const [banner, setBanner] = useState(null);

  const load = useCallback(() => auctionApi.current().then(setState).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const prevAuctionRef = useRef(null);
  const lastReleaseRef = useRef(undefined);

  // Show a RELEASED banner whenever a new release appears (works with sockets and polling).
  const latestRelease = state?.recentReleases?.[0];
  useEffect(() => {
    if (!state) return;
    const id = latestRelease?.id || null;
    if (lastReleaseRef.current === undefined) { lastReleaseRef.current = id; return; }
    if (id && id !== lastReleaseRef.current) {
      lastReleaseRef.current = id;
      playEvent('unsold');
      setBanner({ type: 'released', player: latestRelease.player?.name, playerNo: latestRelease.player?.playerNo, photo: latestRelease.player?.photo, team: latestRelease.team?.name });
      setTimeout(() => setBanner(null), 6000);
    }
  }, [latestRelease?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const { auction, settings, stats, roundConfig, serverTime, bids = [], recentReleases = [] } = state;
  const hasBids = !!auction && auction.bidCount > 0;
  const player = auction?.player;

  return (
    <div className="live-page">
      <div className="live-tabs">
        <button className={tab === 'auction' ? 'active' : ''} onClick={() => setTab('auction')}>🔨 Live Auction</button>
        <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}>🛡️ Teams</button>
      </div>

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

      {tab === 'teams' ? <LiveSquads /> : (
      <>
      {auction ? (
        <div className="auction-stage">
          <div className="card player-stage">
            <Avatar src={player.photo} name={player.name} size="huge" square />
            <div className="grow">
              <div className="flex gap-sm flex-wrap" style={{ marginBottom: '.5rem' }}>
                <span className="player-no" style={{ fontSize: '2.2rem' }}>#{player.playerNo ?? '-'}</span>
                <Badge status="LIVE">● ON THE BLOCK</Badge>
                {player.releaseCount > 0 && <Badge tone="warning">Re-Auction{auction.previousTeam?.name ? ` · released by ${auction.previousTeam.name}` : ''}</Badge>}
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

      {recentReleases.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ letterSpacing: 2, marginBottom: '.6rem' }}>♻️ RECENTLY RELEASED PLAYERS</div>
          <div className="release-strip">
            {recentReleases.map((r) => (
              <div key={r.id} className="item">
                <Avatar src={r.player.photo} name={r.player.name} size="sm" />
                <div>
                  <strong>#{r.player.playerNo ?? '-'} {r.player.name}</strong>
                  <div className="small muted">Released by {r.team?.name || 'team'}{r.player.status === 'Sold' ? ' · re-sold' : ' · back in auction'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </>
      )}

      {banner && (
        <div className="sold-banner" onClick={() => setBanner(null)}>
          <div className={`inner ${banner.type}`}>
            <div className="stamp">{banner.type === 'sold' ? 'SOLD!' : banner.type === 'released' ? 'RELEASED' : 'UNSOLD'}</div>
            {banner.type === 'released' && banner.photo && <div style={{ display: 'flex', justifyContent: 'center', margin: '.6rem 0' }}><Avatar src={banner.photo} name={banner.player} size="xl" square /></div>}
            <h2 style={{ fontSize: '2rem' }}>{banner.type === 'released' && banner.playerNo ? `#${banner.playerNo} ` : ''}{banner.player}</h2>
            {banner.type === 'released' && (
              <div style={{ fontSize: '1.4rem' }}>released by <strong>{banner.team}</strong> · back in the auction pool</div>
            )}
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
