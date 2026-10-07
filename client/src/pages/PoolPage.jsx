import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { auctionApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr, fmtDate } from '../utils/format.js';

/**
 * Unsold players (candidates for the next round), the current auction pool,
 * and every player that has ever been released.
 */
export default function PoolPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'unsold';
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [rounds, setRounds] = useState(null);

  const load = useCallback(() => {
    Promise.all([auctionApi.pool(), auctionApi.rounds()])
      .then(([p, r]) => { setData(p); setRounds(r); })
      .catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  const reauction = async () => {
    const ok = await confirm({
      title: `Start Round ${(rounds?.currentRound || 1) + 1}?`,
      message: `Round ${rounds?.currentRound} will be closed. ${data.unsold.length} unsold players will be moved to RE-AUCTION and join ${data.pool.length} players already in the pool.`,
      confirmText: 'Start re-auction round', tone: 'accent',
    });
    if (!ok) return;
    try { const r = await auctionApi.reauction(true); toast.success(r.message); load(); } catch (e) { toast.error(e.message); }
  };

  const auctionNow = async (p) => {
    try { await auctionApi.start(p._id); navigate('/auction'); } catch (e) { toast.error(e.message); }
  };

  if (!data) return <Spinner full />;
  const setTab = (t) => setParams({ tab: t });

  const Table = ({ rows, showPrev, showAuction }) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Player</th><th>Type</th><th className="num">Base Price</th><th>Status</th>
            {showPrev && <th>Previous</th>}<th>Round</th><th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p._id}>
              <td><div className="flex row-click" onClick={() => navigate(`/players/${p._id}`)}><Avatar src={p.photo} name={p.name} size="sm" /><strong>{p.name}</strong></div></td>
              <td>{p.playerType}</td>
              <td className="num">{inr(p.basePrice)}</td>
              <td><Badge status={p.status} /></td>
              {showPrev && <td className="small muted">{p.releaseCount > 0 ? `Released ${p.releaseCount}× · ${fmtDate(p.lastReleasedAt)}` : 'Unsold in round ' + p.auctionRound}{p.currentTeam ? ` · now ${p.currentTeam.name}` : ''}</td>}
              <td>{p.auctionRound}</td>
              <td className="text-right">
                {showAuction && ['Available', 'Re-Auction', 'Released'].includes(p.status) && <button className="btn btn-primary btn-sm" onClick={() => auctionNow(p)}>Auction now</button>}
                {!showAuction && <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/players/${p._id}`)}>History</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Unsold, Pool & Released"
        subtitle={`Round ${rounds?.currentRound} · ${data.pool.length} in pool · ${data.unsold.length} unsold · ${data.released.length} released`}
        actions={<button className="btn btn-accent" onClick={reauction} disabled={data.unsold.length === 0 && data.pool.length === 0}>🔁 Re-Auction (start Round {(rounds?.currentRound || 1) + 1})</button>}
      />

      <div className="tabs">
        <button className={tab === 'unsold' ? 'active' : ''} onClick={() => setTab('unsold')}>Unsold Players ({data.unsold.length})</button>
        <button className={tab === 'pool' ? 'active' : ''} onClick={() => setTab('pool')}>Current Pool ({data.pool.length})</button>
        <button className={tab === 'released' ? 'active' : ''} onClick={() => setTab('released')}>Released Players ({data.released.length})</button>
      </div>

      {tab === 'unsold' && (data.unsold.length === 0 ? <EmptyState icon="🎉" title="No unsold players" /> : (
        <>
          <p className="small muted">These players received no winning bid in their round. Click Re-Auction to move them all into the next round, or auction one right away.</p>
          <Table rows={data.unsold} showPrev showAuction={false} />
        </>
      ))}
      {tab === 'pool' && (data.pool.length === 0 ? <EmptyState icon="🏏" title="Pool is empty for this round" /> : <Table rows={data.pool} showPrev showAuction />)}
      {tab === 'released' && (data.released.length === 0 ? <EmptyState icon="♻️" title="No players have been released" /> : <Table rows={data.released} showPrev showAuction />)}
    </>
  );
}
