import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Spinner from '../components/Spinner.jsx';
import { playersApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr } from '../utils/format.js';

const EMPTY_META = { playerTypes: [], battingStyles: [], bowlingStyles: [], statuses: [] };

export default function PlayersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [meta, setMeta] = useState(EMPTY_META);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState(params.get('search') || '');

  const q = {
    search: params.get('search') || '',
    playerType: params.get('playerType') || '',
    battingStyle: params.get('battingStyle') || '',
    bowlingStyle: params.get('bowlingStyle') || '',
    status: params.get('status') || '',
    sort: params.get('sort') || 'name',
    order: params.get('order') || 'asc',
    page: Number(params.get('page') || 1),
    limit: 20,
  };

  const setQ = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries({ ...patch, ...(patch.page === undefined ? { page: 1 } : {}) }).forEach(([k, v]) => {
      if (v === '' || v === undefined || v === null || (k === 'page' && v === 1)) next.delete(k);
      else next.set(k, v);
    });
    setParams(next);
  };

  useEffect(() => { playersApi.meta().then(setMeta).catch(() => {}); }, []);

  const load = useCallback(() => {
    playersApi.list(q).then(setData).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket((event) => { if (['players:updated', 'auction:sold', 'auction:unsold', 'player:released', 'round:started'].includes(event)) load(); });

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { if (search !== q.search) setQ({ search }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleSort = (field) => {
    if (q.sort === field) setQ({ order: q.order === 'asc' ? 'desc' : 'asc', page: q.page });
    else setQ({ sort: field, order: 'asc', page: q.page });
  };
  const arrow = (field) => (q.sort === field ? (q.order === 'asc' ? ' ▲' : ' ▼') : '');

  const remove = async (p) => {
    const ok = await confirm({ title: `Delete ${p.name}?`, message: 'This permanently removes the player. Players with auction history cannot be deleted.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await playersApi.remove(p._id); toast.success('Player deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  const release = async (p) => {
    const ok = await confirm({
      title: `Release ${p.name}?`,
      message: `${p.name} will be removed from ${p.currentTeam?.name || 'the team'}'s squad, ${inr(p.soldPrice)} will be refunded, and the player goes to RE-AUCTION. The original sale record is preserved.`,
      confirmText: 'Release player', tone: 'accent',
    });
    if (!ok) return;
    try { const r = await playersApi.release(p._id); toast.success(r.message); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={data ? `${data.total} players` : 'Manage the player pool'}
        actions={<button className="btn btn-primary" onClick={() => navigate('/players/new')}>➕ Add Player</button>}
      />

      <div className="filters">
        <input className="search" placeholder="🔍 Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={q.playerType} onChange={(e) => setQ({ playerType: e.target.value })}>
          <option value="">All types</option>
          {meta.playerTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={q.battingStyle} onChange={(e) => setQ({ battingStyle: e.target.value })}>
          <option value="">All batting</option>
          {meta.battingStyles.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={q.bowlingStyle} onChange={(e) => setQ({ bowlingStyle: e.target.value })}>
          <option value="">All bowling</option>
          {meta.bowlingStyles.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={q.status} onChange={(e) => setQ({ status: e.target.value })}>
          <option value="">All statuses</option>
          {meta.statuses.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={`${q.sort}:${q.order}`} onChange={(e) => { const [sort, order] = e.target.value.split(':'); setQ({ sort, order, page: q.page }); }}>
          <option value="name:asc">Name A→Z</option>
          <option value="name:desc">Name Z→A</option>
          <option value="basePrice:asc">Base price ↑</option>
          <option value="basePrice:desc">Base price ↓</option>
          <option value="status:asc">Status A→Z</option>
          <option value="createdAt:desc">Newest first</option>
        </select>
      </div>

      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <EmptyState title="No players match these filters">
          <button className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button>
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort('name')}>Player{arrow('name')}</th>
                  <th className="sortable" onClick={() => toggleSort('playerType')}>Type{arrow('playerType')}</th>
                  <th>Batting</th>
                  <th>Bowling</th>
                  <th>Size</th>
                  <th className="num sortable" onClick={() => toggleSort('basePrice')}>Base Price{arrow('basePrice')}</th>
                  <th className="sortable" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                  <th>Team</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="flex row-click" onClick={() => navigate(`/players/${p._id}`)}>
                        <Avatar src={p.photo} name={p.name} size="sm" />
                        <div>
                          <strong>{p.name}</strong>
                          <div className="small muted">{p.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.playerType}</td>
                    <td>{p.battingStyle}</td>
                    <td>{p.bowlingStyle}</td>
                    <td>{p.tshirtSize}</td>
                    <td className="num">{inr(p.basePrice)}</td>
                    <td><Badge status={p.status} /></td>
                    <td>{p.currentTeam ? <span className="flex gap-sm"><span className="color-dot" style={{ background: p.currentTeam.color }} />{p.currentTeam.name} <span className="small muted">({inr(p.soldPrice)})</span></span> : <span className="muted">-</span>}</td>
                    <td className="text-right nowrap">
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/players/${p._id}`)}>View</button>{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/players/${p._id}/edit`)}>Edit</button>{' '}
                      {p.status === 'Sold' ? (
                        <button className="btn btn-accent btn-sm" onClick={() => release(p)}>Release</button>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(page) => setQ({ page })} />
        </>
      )}
    </>
  );
}
