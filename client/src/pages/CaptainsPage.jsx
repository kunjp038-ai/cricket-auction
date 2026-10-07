import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { captainsApi, teamsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';

const EMPTY = { name: '', phone: '', photo: '', team: '' };

export default function CaptainsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [captains, setCaptains] = useState(null);
  const [teams, setTeams] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | captain
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([captainsApi.list(), teamsApi.list()])
      .then(([c, t]) => { setCaptains(c.captains); setTeams(t.teams); })
      .catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditing({}); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone, photo: c.photo || '', team: c.team?._id || '' }); setEditing(c); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, team: form.team || null };
      const res = editing._id ? await captainsApi.update(editing._id, payload) : await captainsApi.create(payload);
      toast.success(res.message);
      setEditing(null);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const remove = async (c) => {
    const ok = await confirm({ title: `Delete captain ${c.name}?`, message: 'The team will be left without a captain.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await captainsApi.remove(c._id); toast.success('Captain deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  const quickAssign = async (c, teamId) => {
    try {
      await captainsApi.update(c._id, { team: teamId || null });
      toast.success(teamId ? 'Captain assigned' : 'Captain unassigned');
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (!captains) return <Spinner full />;
  const teamOf = (teamId) => teams.find((t) => t._id === teamId);

  return (
    <>
      <PageHeader title="Captains" subtitle="Each team has exactly one captain. Assigning a captain to a new team moves them automatically." actions={<button className="btn btn-primary" onClick={openNew}>➕ Add Captain</button>} />

      <div className="grid grid-2 mb">
        <div className="card">
          <div className="card-title"><h2>Teams &amp; their captains</h2></div>
          <div className="stack">
            {teams.map((t) => (
              <div key={t._id} className="flex">
                <Avatar src={t.logo} name={t.name} size="sm" square color={t.color} />
                <strong className="grow">{t.name}</strong>
                {t.captain ? <span className="flex gap-sm"><Avatar src={t.captain.photo} name={t.captain.name} size="sm" />{t.captain.name}</span> : <span className="badge badge-warning">No captain</span>}
              </div>
            ))}
            {teams.length === 0 && <p className="muted">No teams created yet.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><h2>All captains</h2></div>
          {captains.length === 0 ? <EmptyState icon="🎖️" title="No captains yet" /> : (
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table>
                <thead><tr><th>Captain</th><th>Phone</th><th>Team</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {captains.map((c) => (
                    <tr key={c._id}>
                      <td><div className="flex"><Avatar src={c.photo} name={c.name} size="sm" /><strong>{c.name}</strong></div></td>
                      <td>{c.phone}</td>
                      <td>
                        <select value={c.team?._id || ''} onChange={(e) => quickAssign(c, e.target.value)} style={{ minWidth: 160 }}>
                          <option value="">— Unassigned —</option>
                          {teams.map((t) => <option key={t._id} value={t._id}>{t.name}{t.captain && t.captain._id !== c._id ? ` (has ${t.captain.name})` : ''}</option>)}
                        </select>
                      </td>
                      <td className="text-right nowrap">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>{' '}
                        <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? 'Edit Captain' : 'Add Captain'}>
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <div className="field"><label>Captain Name <span className="req">*</span></label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Phone Number <span className="req">*</span></label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" /></div>
            <div className="field full">
              <label>Team</label>
              <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                <option value="">— Unassigned —</option>
                {teams.map((t) => <option key={t._id} value={t._id}>{t.name}{t.captain && t.captain._id !== editing?._id ? ` (replaces ${t.captain.name})` : ''}</option>)}
              </select>
              {form.team && teamOf(form.team)?.captain && teamOf(form.team).captain._id !== editing?._id && (
                <span className="help">⚠ {teamOf(form.team).captain.name} will be unassigned from {teamOf(form.team).name}.</span>
              )}
            </div>
            <PhotoUpload value={form.photo} name={form.name} onChange={(v) => setForm((f) => ({ ...f, photo: v }))} label="Captain Photo" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
