import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Spinner from '../components/Spinner.jsx';
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

  const { connected, polling } = useAuctionSocket(
    async (event, payload) => {
      if (payload?.state) setState(payload.state);
      if (event === 'auction:sold') {
        setBanner({ type: 'sold', ...payload.sale });
        setTimeout(() => setBanner(null), 5000);
      }
      if (event === 'auction:unsold') {
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
              if (last.status === 'SOLD') setBanner({ type: 'sold', player: last.player?.name, team: last.winningTeam?.name, amount: last.finalBid });
              else if (last.status === 'UNSOLD') setBanner({ type: 'unsold', player: last.player?.name });
              setTimeout(() => setBanner(null), 4500);
            }
          } catch (e) { /* ignore */ }
        }
      }
    },
    { poll: true, interval: 2500 }
  );

  if (!state) return <Spinner full />;
  const { auction, teams, settings, stats } = state;
  const player = auction?.player;

  return (
    <div className="live-page">
      <div className="auction-top">
        <div className="card title flex between">
          <div>
            <div className="small muted" style={{ letterSpacing: 3 }}>{settings.auctionName.toUpperCase()}</div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Round {stats.round}</h1>
          </div>
          <span className="small muted flex gap-sm"><span className={`live-dot ${connected || polling ? 'on' : ''}`} />{connected || polling ? 'LIVE' : 'Reconnecting…'}</span>
        </div>
        <div className="card kpi"><span className="label">Players Remaining</span><span className="value">{stats.playersRemaining}</span></div>
        <div className="card kpi tone-success"><span className="label">Total Sold</span><span className="value">{stats.totalSold}</span></div>
        <div className="card kpi tone-danger"><span className="label">Total Unsold</span><span className="value">{stats.totalUnsold}</span></div>
        <div className="card kpi tone-warning"><span className="label">Teams</span><span className="value">{teams.length}</span></div>
      </div>

      {auction ? (
        <div className="auction-stage">
          <div className="card player-stage">
            <Avatar src={player.photo} name={player.name} size="xl" />
            <div className="grow">
              <div className="flex gap-sm"><Badge status="LIVE">● ON THE BLOCK</Badge>{player.releaseCount > 0 && <Badge tone="warning">Re-Auction</Badge>}</div>
              <div className="name">{player.name}</div>
              <div className="meta">
                <span className="chip">{player.playerType}</span>
                <span className="chip">🏏 {player.battingStyle}</span>
                <span className="chip">🎯 {player.bowlingStyle}</span>
                <span className="chip">👕 {player.tshirtSize}</span>
              </div>
              <div><span className="muted">Base Price </span><strong style={{ fontSize: '1.6rem' }}>{inr(auction.basePrice)}</strong></div>
            </div>
          </div>
          <div className="card bid-box">
            <div className="muted" style={{ letterSpacing: 3 }}>BASE PRICE</div>
            <div className="current">{inr(auction.basePrice)}</div>
            <div className="bidder" style={{ fontSize: '1.4rem' }}>🔨 Bidding in progress…</div>
            {settings.maxBid > 0 && <div className="next">Maximum bid {inr(settings.maxBid)}</div>}
          </div>
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '3rem' }}>🏏</div>
          <h2>Next player coming up…</h2>
          <p className="muted">{stats.playersRemaining} players remaining in Round {stats.round}</p>
        </div>
      )}

      <div className="team-bid-grid">
        {teams.map((t) => <TeamCard key={t._id} team={t} />)}
      </div>

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
