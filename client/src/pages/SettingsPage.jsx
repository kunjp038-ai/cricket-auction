import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';
import { settingsApi, authApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { inr } from '../utils/format.js';

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => { settingsApi.get().then((r) => setForm(r.settings)).catch((e) => toast.error(e.message)); }, [toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const setRound = (i, k, v) => setForm((f) => {
    const rc = f.roundConfigs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r));
    return { ...f, roundConfigs: rc };
  });
  const addRound = () => setForm((f) => {
    const next = (f.roundConfigs.reduce((m, r) => Math.max(m, Number(r.round) || 0), 0)) + 1;
    const last = f.roundConfigs[f.roundConfigs.length - 1];
    return { ...f, roundConfigs: [...f.roundConfigs, { round: next, basePrice: last ? last.basePrice : f.defaultBasePrice, timerSeconds: last ? last.timerSeconds : f.defaultTimerSeconds }] };
  });
  const removeRound = (i) => setForm((f) => ({ ...f, roundConfigs: f.roundConfigs.filter((_, idx) => idx !== i) }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await settingsApi.update({
        auctionName: form.auctionName,
        bidIncrement: Number(form.bidIncrement),
        maxBid: Number(form.maxBid),
        defaultBasePrice: Number(form.defaultBasePrice),
        defaultTimerSeconds: Number(form.defaultTimerSeconds),
        allowPreviousTeamRebid: Boolean(form.allowPreviousTeamRebid),
        autoNextPlayer: Boolean(form.autoNextPlayer),
        roundConfigs: form.roundConfigs.map((rc) => ({ round: Number(rc.round), basePrice: Number(rc.basePrice), timerSeconds: Number(rc.timerSeconds) })),
      });
      setForm(r.settings);
      toast.success(r.message);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    try { const r = await authApi.changePassword(pw); toast.success(r.message); setPw({ currentPassword: '', newPassword: '' }); } catch (err) { toast.error(err.message); }
  };

  if (!form) return <Spinner full />;

  return (
    <>
      <PageHeader title="Auction Settings" subtitle="Base price and timer per round, auction behaviour, admin password" />
      <div className="grid grid-2">
        <form className="card" onSubmit={save}>
          <h2>Rounds: base price &amp; timer</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Every player in a round is auctioned at the same base price with the same countdown. Current round: <strong>{form.currentRound}</strong>.</p>
          <div className="table-wrap rounds-table" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>Round</th><th>Base price (₹)</th><th>Timer (seconds)</th><th /></tr></thead>
              <tbody>
                {form.roundConfigs.map((rc, i) => (
                  <tr key={i} style={Number(rc.round) === form.currentRound ? { background: 'rgba(34,197,94,.08)' } : undefined}>
                    <td><input type="number" min="1" value={rc.round} onChange={(e) => setRound(i, 'round', e.target.value)} required /></td>
                    <td><input type="number" min="0" step="100" value={rc.basePrice} onChange={(e) => setRound(i, 'basePrice', e.target.value)} required /></td>
                    <td><input type="number" min="0" max="3600" step="5" value={rc.timerSeconds} onChange={(e) => setRound(i, 'timerSeconds', e.target.value)} /></td>
                    <td className="text-right"><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRound(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost btn-sm mt" onClick={addRound}>➕ Add round</button>

          <h2 className="mt">Fallback for rounds not listed</h2>
          <div className="form-grid">
            <div className="field"><label>Base price (₹)</label><input type="number" min="0" step="100" value={form.defaultBasePrice} onChange={set('defaultBasePrice')} /></div>
            <div className="field"><label>Timer (seconds, 0 = off)</label><input type="number" min="0" max="3600" step="5" value={form.defaultTimerSeconds} onChange={set('defaultTimerSeconds')} /></div>
          </div>

          <h2 className="mt">Auction behaviour</h2>
          <div className="form-grid">
            <div className="field full"><label>Auction Name</label><input value={form.auctionName} onChange={set('auctionName')} /></div>
            <div className="field"><label>Price step for −/+ buttons (₹)</label><input type="number" min="1" step="100" value={form.bidIncrement} onChange={set('bidIncrement')} required /></div>
            <div className="field"><label>Maximum sold price (₹)</label><input type="number" min="0" step="100" value={form.maxBid} onChange={set('maxBid')} /><span className="help">0 = no limit.</span></div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={!!form.autoNextPlayer} onChange={set('autoNextPlayer')} /> Auto next player: after SOLD / UNSOLD the next player (by number) comes up automatically</label>
            </div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={!!form.allowPreviousTeamRebid} onChange={set('allowPreviousTeamRebid')} /> Allow the previous team to buy back a released player</label>
            </div>
          </div>
          <div className="modal-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>

        <div className="stack">
          <div className="card">
            <h2>How a round works</h2>
            <ol className="muted" style={{ paddingLeft: '1.2rem', margin: 0 }}>
              <li>Players are called in <strong>player-number order</strong> (#1, #2, #3 …).</li>
              <li>Each player starts at the round's base price{form.roundConfigs[0] ? ` (Round ${form.roundConfigs[0].round}: ${inr(form.roundConfigs[0].basePrice)})` : ''} and the countdown starts.</li>
              <li>Teams bid out loud. When bidding ends, select the winning team, enter the final price and press <strong>SOLD</strong>, or press <strong>UNSOLD</strong>.</li>
              <li>The next player appears automatically. When the round is finished, start the re-auction round: unsold players come back at that round's base price.</li>
            </ol>
          </div>
          <form className="card" onSubmit={changePw}>
            <h2>Change admin password</h2>
            <div className="form-grid">
              <div className="field"><label>Current password</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" /></div>
              <div className="field"><label>New password</label><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} autoComplete="new-password" /></div>
            </div>
            <div className="modal-actions"><button className="btn btn-ghost">Update password</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
