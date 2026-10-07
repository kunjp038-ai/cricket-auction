import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Spinner from '../components/Spinner.jsx';
import { playersApi, auctionApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr, fmtDate } from '../utils/format.js';

export default function PlayerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);

  const load = useCallback(() => playersApi.history(id).then(setData).catch((e) => toast.error(e.message)), [id, toast]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  if (!data) return <Spinner full />;
  const { player, timeline, transactions, currentOwner } = data;

  const release = async () => {
    const ok = await confirm({
      title: `Release ${player.name}?`,
      message: `Removes the player from ${currentOwner?.name}, refunds ${inr(player.soldPrice)} to the team and puts the player up for RE-AUCTION. History is preserved.`,
      confirmText: 'Release player', tone: 'accent',
    });
    if (!ok) return;
    try { const r = await playersApi.release(id); toast.success(r.message); load(); } catch (e) { toast.error(e.message); }
  };

  const auctionNow = async () => {
    try { await auctionApi.start(id); navigate('/auction'); } catch (e) { toast.error(e.message); }
  };

  const canAuction = ['Available', 'Re-Auction', 'Released'].includes(player.status);

  return (
    <>
      <PageHeader
        title={`#${player.playerNo ?? '-'} ${player.name}`}
        subtitle={`${player.playerType} · ${player.battingStyle} · ${player.bowlingStyle}`}
        actions={
          <>
            <Link to={`/players/${id}/edit`} className="btn btn-ghost">✏️ Edit</Link>
            {player.status === 'Sold' && <button className="btn btn-accent" onClick={release}>♻️ Release Player</button>}
            {canAuction && <button className="btn btn-primary" onClick={auctionNow}>🔨 Auction Now</button>}
          </>
        }
      />

      <div className="grid grid-3 mb">
        <div className="card flex" style={{ gap: '1.2rem' }}>
          <Avatar src={player.photo} name={player.name} size="xl" />
          <div className="stack gap-sm">
            <Badge status={player.status} />
            <div><span className="muted small">T-Shirt</span><br /><strong>{player.tshirtSize}</strong></div>
            <div><span className="muted small">Phone</span><br /><strong>{player.phone}</strong></div>
          </div>
        </div>
        <div className="card">
          <h3>Current Ownership</h3>
          {currentOwner ? (
            <>
              <div className="flex row-click" onClick={() => navigate(`/teams/${currentOwner._id}`)}>
                <Avatar src={currentOwner.logo} name={currentOwner.name} square color={currentOwner.color} />
                <div><strong>{currentOwner.name}</strong><div className="small muted">Bought for {inr(player.soldPrice)} · Round {player.auctionRound}</div></div>
              </div>
            </>
          ) : (
            <p className="muted">Not owned by any team.{player.releaseCount > 0 && ` Released ${player.releaseCount} time(s).`}</p>
          )}
          <h3 className="mt">Address</h3>
          <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{player.address || '-'}</p>
        </div>
        <div className="card">
          <h3>Summary</h3>
          <ul className="ledger" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span>Times auctioned</span><span /><strong>{timeline.filter((t) => t.status !== 'CANCELLED').length}</strong></li>
            <li><span>Times sold</span><span /><strong>{timeline.filter((t) => t.status === 'SOLD').length}</strong></li>
            <li><span>Times unsold</span><span /><strong>{timeline.filter((t) => t.status === 'UNSOLD').length}</strong></li>
            <li><span>Times released</span><span /><strong>{player.releaseCount}</strong></li>
            <li><span>Highest price</span><span /><strong>{inr(Math.max(0, ...timeline.map((t) => t.finalBid || 0)))}</strong></li>
          </ul>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><h2>Player Auction History</h2></div>
          {timeline.length === 0 ? <p className="muted">This player has not been auctioned yet.</p> : (
            <ul className="timeline">
              {timeline.map((t) => (
                <li key={t.auctionId} className={t.status === 'UNSOLD' ? 'unsold' : t.releasedAt ? 'released' : ''}>
                  <div className="flex between flex-wrap">
                    <strong>Round {t.round}</strong>
                    <Badge status={t.status} />
                  </div>
                  {t.status === 'SOLD' && (
                    <div>{t.team?.name} → <strong>{inr(t.finalBid)}</strong>
                      {t.releasedAt ? <span className="muted"> · Released {fmtDate(t.releasedAt)}</span> : currentOwner && String(currentOwner._id) === String(t.team?._id) ? <span className="badge badge-success" style={{ marginLeft: 6 }}>Currently owned</span> : null}
                    </div>
                  )}
                  {t.status === 'UNSOLD' && <div className="muted">No winning bid (base {inr(t.basePrice)})</div>}
                  {t.status === 'LIVE' && <div className="muted">Currently on the block</div>}
                  <div className="small muted">{fmtDate(t.completedAt || t.startedAt)} · {t.bids.length} bid(s)</div>
                  {t.bids.length > 0 && (
                    <details className="small">
                      <summary className="muted row-click">Show bids</summary>
                      <ul className="bid-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {[...t.bids].reverse().map((b) => <li key={b._id}><span>{b.team?.name || b.bidderName}</span><span>{inr(b.amount)}</span></li>)}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h2>Financial Entries</h2></div>
          {transactions.length === 0 ? <p className="muted">No transactions for this player.</p> : (
            <ul className="ledger" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {transactions.map((t) => (
                <li key={t._id}>
                  <span><strong>{t.team?.name}</strong><div className="small muted">{t.description} · {fmtDate(t.createdAt)}</div></span>
                  <Badge tone={t.amount >= 0 ? 'success' : 'danger'}>{t.type.replace('_', ' ')}</Badge>
                  <span className={t.amount >= 0 ? 'credit' : 'debit'}>{t.amount >= 0 ? '+' : '-'}{inr(Math.abs(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
