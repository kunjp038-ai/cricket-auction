import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import TeamCard from '../components/TeamCard.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { teamsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';
import { inr } from '../utils/format.js';

export default function TeamsPage() {
  const [teams, setTeams] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => teamsApi.list().then((r) => setTeams(r.teams)).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);
  useAuctionSocket(() => load());

  const remove = async (team) => {
    const ok = await confirm({ title: `Delete ${team.name}?`, message: 'Teams that still own players cannot be deleted.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await teamsApi.remove(team._id); toast.success('Team deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  if (!teams) return <Spinner full />;
  const totals = teams.reduce((a, t) => ({ budget: a.budget + t.totalBudget, used: a.used + t.usedBudget, players: a.players + (t.players?.length || 0) }), { budget: 0, used: 0, players: 0 });

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={`${teams.length} teams · ${inr(totals.used)} spent of ${inr(totals.budget)} · ${totals.players} players bought`}
        actions={<button className="btn btn-primary" onClick={() => navigate('/teams/new')}>➕ Add Team</button>}
      />
      {teams.length === 0 ? (
        <EmptyState icon="🛡️" title="No teams yet"><button className="btn btn-primary" onClick={() => navigate('/teams/new')}>Create the first team</button></EmptyState>
      ) : (
        <div className="grid grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {teams.map((t) => (
            <TeamCard
              key={t._id}
              team={t}
              onClick={() => navigate(`/teams/${t._id}`)}
              footer={
                <div className="flex" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm grow" onClick={() => navigate(`/teams/${t._id}`)}>Dashboard</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/teams/${t._id}/edit`)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>Delete</button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
