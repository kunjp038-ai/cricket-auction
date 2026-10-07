import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { auctionApi, teamsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr, fmtDate } from '../utils/format.js';

export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [search, setSearch] = useState(params.get('search') || '');

  const q = {
    search: params.get('search') || '', round: params.get('round') || '', team: params.get('team') || '',
    status: params.get('status') || '', released: params.get('released') || '', page: Number(params.get('page') || 1), limit: 25,
  };
  const setQ = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: 1, ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (next.get('page') === '1') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    teamsApi.list().then((r) => setTeams(r.teams)).catch(() => {});
    auctionApi.rounds().then((r) => setRounds(r.rounds)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    auctionApi.history(q).then(setData).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket((event) => { if (['auction:sold', 'auction:unsold', 'player:released'].includes(event)) load(); });

  useEffect(() => {
    const t = setTimeout(() => { if (search !== q.search) setQ({ search }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalShown = data?.items.filter((a) => a.status === 'SOLD').reduce((s, a) => s + (a.finalBid || 0), 0) || 0;

  return (
    <>
      <PageHeader title="Auction History" subtitle="Every auction record is permanent. Released players keep their original sale row." />

      <div className="filters" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
        <input className="search" placeholder="🔍 Search player…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={q.round} onChange={(e) => setQ({ round: e.target.value })}>
          <option value="">All rounds</option>
          {rounds.map((r) => <option key={r.number} value={r.number}>Round {r.number}</option>)}
        </select>
        <select value={q.team} onChange={(e) => setQ({ team: e.target.value })}>
          <option value="">All teams</option>
          {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select value={q.status} onChange={(e) => setQ({ status: e.target.value })}>
          <option value="">Sold + Unsold</option>
          <option value="SOLD">Sold</option>
          <option value="UNSOLD">Unsold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={q.released} onChange={(e) => setQ({ released: e.target.value })}>
          <option value="">Any</option>
          <option value="true">Later released</option>
        </select>
      </div>

      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState icon="📜" title="No auction records match" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Player</th><th className="num">Round</th><th>Team</th><th className="num">Amount</th><th>Status</th><th>Date / Time</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a._id} className="row-click" onClick={() => navigate(`/players/${a.player?._id}`)}>
                    <td><div className="flex"><Avatar src={a.player?.photo} name={a.player?.name} size="sm" /><div><strong>{a.player?.name || 'Deleted player'}</strong><div className="small muted">{a.player?.playerType}</div></div></div></td>
                    <td className="num">{a.round}</td>
                    <td>{a.winningTeam ? <span className="flex gap-sm"><span className="color-dot" style={{ background: a.winningTeam.color }} />{a.winningTeam.name}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{a.status === 'SOLD' ? inr(a.finalBid) : <span className="muted">base {inr(a.basePrice)}</span>}</td>
                    <td>
                      <Badge status={a.status === 'SOLD' ? 'Sold' : a.status === 'UNSOLD' ? 'Unsold' : a.status} />
                      {a.releasedAt && <> <Badge tone="warning">Released</Badge></>}
                    </td>
                    <td className="small muted nowrap">{fmtDate(a.completedAt || a.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colSpan={3}>Sold total on this page</th><th className="num">{inr(totalShown)}</th><th colSpan={2} /></tr></tfoot>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(page) => setQ({ page })} />
        </>
      )}
    </>
  );
}
