import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import Spinner from '../components/Spinner.jsx';
import { teamsApi, captainsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { inr } from '../utils/format.js';

const COLORS = ['#d62828', '#1d4ed8', '#15803d', '#ca8a04', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];
const EMPTY = { name: '', logo: '', color: COLORS[1], totalBudget: 50000, maxPlayers: 15, minPlayers: 11, captain: '' };

export default function TeamFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [team, setTeam] = useState(null);
  const [captains, setCaptains] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    captainsApi.list().then((r) => setCaptains(r.captains)).catch(() => {});
    if (isEdit) {
      teamsApi.get(id).then((r) => {
        const t = r.team;
        setTeam(t);
        setForm({ name: t.name, logo: t.logo || '', color: t.color || COLORS[1], totalBudget: t.totalBudget, maxPlayers: t.maxPlayers, minPlayers: t.minPlayers, captain: t.captain?._id || '' });
        setLoaded(true);
      }).catch((e) => toast.error(e.message));
    }
  }, [id, isEdit, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(), logo: form.logo, color: form.color,
        totalBudget: Number(form.totalBudget), maxPlayers: Number(form.maxPlayers), minPlayers: Number(form.minPlayers),
        captain: form.captain || null,
      };
      const res = isEdit ? await teamsApi.update(id, payload) : await teamsApi.create(payload);
      toast.success(res.message);
      navigate(`/teams/${res.team._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Spinner full />;

  // A captain already assigned to another team can still be picked - they will be moved.
  const captainOptions = captains.map((c) => ({
    ...c,
    label: `${c.name}${c.team && c.team._id !== id ? ` (currently ${c.team.name})` : ''}`,
  }));

  return (
    <>
      <PageHeader title={isEdit ? `Edit ${team?.name}` : 'Add Team'} subtitle={isEdit ? `Used ${inr(team.usedBudget)} · Remaining ${inr(team.remainingBudget)}` : 'Create a franchise with its budget and squad limits'} />
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>Team Name <span className="req">*</span></label>
            <input value={form.name} onChange={set('name')} required placeholder="e.g. Royal Strikers" />
          </div>
          <div className="field">
            <label>Total Budget (₹) <span className="req">*</span></label>
            <input type="number" min={team?.usedBudget || 0} step="500" value={form.totalBudget} onChange={set('totalBudget')} required />
            {isEdit && <span className="help">Changing the budget records a BUDGET_ADJUSTMENT in the ledger. Cannot go below {inr(team.usedBudget)} already used.</span>}
          </div>
          <div className="field">
            <label>Maximum Players</label>
            <input type="number" min={team?.players?.length || 1} max="50" value={form.maxPlayers} onChange={set('maxPlayers')} />
          </div>
          <div className="field">
            <label>Minimum Players</label>
            <input type="number" min="0" max="50" value={form.minPlayers} onChange={set('minPlayers')} />
          </div>
          <div className="field">
            <label>Captain</label>
            <select value={form.captain} onChange={set('captain')}>
              <option value="">— No captain —</option>
              {captainOptions.map((c) => <option key={c._id} value={c._id}>{c.label}</option>)}
            </select>
            <span className="help">Only one captain per team. Manage captains on the Captains page.</span>
          </div>
          <div className="field">
            <label>Team Colour</label>
            <div className="flex flex-wrap">
              {COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className="btn btn-icon" style={{ background: c, outline: form.color === c ? '3px solid #fff' : 'none' }} aria-label={c} />
              ))}
              <input type="color" value={form.color} onChange={set('color')} style={{ width: 44, padding: 2 }} />
            </div>
          </div>
          <PhotoUpload value={form.logo} name={form.name} square onChange={(v) => setForm((f) => ({ ...f, logo: v }))} label="Team Logo / Icon" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create team'}</button>
        </div>
      </form>
    </>
  );
}
