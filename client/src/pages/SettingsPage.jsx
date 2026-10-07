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

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await settingsApi.update({
        auctionName: form.auctionName,
        bidIncrement: Number(form.bidIncrement),
        minBid: Number(form.minBid),
        maxBid: Number(form.maxBid),
        defaultBasePrice: Number(form.defaultBasePrice),
        allowPreviousTeamRebid: Boolean(form.allowPreviousTeamRebid),
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
  const base = Number(form.defaultBasePrice) || 0;
  const inc = Number(form.bidIncrement) || 0;

  return (
    <>
      <PageHeader title="Bid Rules & Settings" subtitle="Configure how bidding works during the live auction" />
      <div className="grid grid-2">
        <form className="card" onSubmit={save}>
          <h2>Auction rules</h2>
          <div className="form-grid">
            <div className="field full"><label>Auction Name</label><input value={form.auctionName} onChange={set('auctionName')} /></div>
            <div className="field"><label>Default Base Price (₹)</label><input type="number" min="0" step="100" value={form.defaultBasePrice} onChange={set('defaultBasePrice')} /><span className="help">Pre-filled when adding a player.</span></div>
            <div className="field"><label>Bid Increment (₹)</label><input type="number" min="1" step="100" value={form.bidIncrement} onChange={set('bidIncrement')} required /><span className="help">Each bid adds this to the current bid. First bid = base price.</span></div>
            <div className="field"><label>Minimum Bid / Base Price (₹)</label><input type="number" min="0" step="100" value={form.minBid} onChange={set('minBid')} /><span className="help">Players cannot be created with a base price below this.</span></div>
            <div className="field"><label>Maximum Bid (₹)</label><input type="number" min="0" step="100" value={form.maxBid} onChange={set('maxBid')} /><span className="help">0 = no limit. Bids above this are rejected.</span></div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={!!form.allowPreviousTeamRebid} onChange={set('allowPreviousTeamRebid')} /> Allow previous team to re-bid for a released player</label>
              <span className="help">When off, the team that released a player cannot bid for them in the re-auction.</span>
            </div>
            <div className="field full"><label>Current Round</label><input value={form.currentRound} disabled /><span className="help">Advances automatically when you start a re-auction round.</span></div>
          </div>
          <div className="modal-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save rules'}</button></div>
        </form>

        <div className="stack">
          <div className="card">
            <h2>Bid ladder preview</h2>
            <p className="small muted">Example for a player with base price {inr(base)}:</p>
            <ul className="bid-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const amt = base + i * inc;
                const overMax = Number(form.maxBid) > 0 && amt > Number(form.maxBid);
                return <li key={i} style={{ color: overMax ? '#fca5a5' : undefined }}><span>Bid {i + 1}{i === 0 ? ' (base)' : ''}</span><span className="mono">{inr(amt)}{overMax ? ' ✕ over max' : ''}</span></li>;
              })}
            </ul>
            <p className="small muted">A team can only bid if the next amount ≤ its remaining budget, otherwise it sees “Insufficient budget for this bid.”</p>
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
