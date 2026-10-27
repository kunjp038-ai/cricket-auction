import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';
import SoundSettings from '../components/SoundSettings.jsx';
import { settingsApi, authApi, auctionApi } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { inr } from '../utils/format.js';

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [keepSpecial, setKeepSpecial] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const doReset = async () => {
    setResetBusy(true);
    try {
      const r = await auctionApi.reset(keepSpecial);
      setResetResult(r.summary);
      toast.success(r.message, 8000);
      setResetOpen(false);
      setResetText('');
    } catch (e) { toast.error(e.message); } finally { setResetBusy(false); }
  };

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
        bidIncrement2: Number(form.bidIncrement2 || 1000),
        captainPrice: Number(form.captainPrice || 0),
        iconPrice: Number(form.iconPrice || 0),
        maxBid: Number(form.maxBid),
        defaultBasePrice: Number(form.defaultBasePrice),
        defaultTimerSeconds: Number(form.defaultTimerSeconds),
        allowPreviousTeamRebid: Boolean(form.allowPreviousTeamRebid),
        autoNextPlayer: Boolean(form.autoNextPlayer),
        autoNextDelaySeconds: Number(form.autoNextDelaySeconds ?? 5),
        showBidsOnLive: form.showBidsOnLive !== false,
        showPricesOnLiveTeams: form.showPricesOnLiveTeams === true,
        auctionOrder: form.auctionOrder || 'random',
        sounds: form.sounds || {},
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

  const resetModal = (
    <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset the whole auction?" size="sm">
      <p className="muted" style={{ marginTop: 0 }}>This clears every sale, bid and round and puts all players back in the pool. {keepSpecial ? 'Captain & Icon picks will be kept.' : 'Captain & Icon picks will also be removed.'} This cannot be undone.</p>
      <div className="field"><label>Type <strong>RESET</strong> to confirm</label><input value={resetText} onChange={(e) => setResetText(e.target.value.toUpperCase())} placeholder="RESET" autoFocus /></div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>Cancel</button>
        <button type="button" className="btn btn-danger" disabled={resetText !== 'RESET' || resetBusy} onClick={doReset}>{resetBusy ? 'Resetting…' : 'Yes, reset auction'}</button>
      </div>
    </Modal>
  );

  return (
    <>
      {resetModal}
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
                    <td><input type="number" min="0" step="any" value={rc.basePrice} onChange={(e) => setRound(i, 'basePrice', e.target.value)} required /></td>
                    <td><input type="number" min="0" max="3600" step="1" value={rc.timerSeconds} onChange={(e) => setRound(i, 'timerSeconds', e.target.value)} /></td>
                    <td className="text-right"><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRound(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost btn-sm mt" onClick={addRound}>➕ Add round</button>

          <h2 className="mt">Captain &amp; Icon price</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Every team picks one Captain and one Icon player before the auction at these fixed prices (Team page → Captain &amp; Icon players).</p>
          <div className="form-grid">
            <div className="field"><label>©️ Captain price (₹)</label><input type="number" min="0" step="any" value={form.captainPrice ?? 0} onChange={set('captainPrice')} /></div>
            <div className="field"><label>⭐ Icon price (₹)</label><input type="number" min="0" step="any" value={form.iconPrice ?? 0} onChange={set('iconPrice')} /></div>
          </div>

          <h2 className="mt">Fallback for rounds not listed</h2>
          <div className="form-grid">
            <div className="field"><label>Base price (₹)</label><input type="number" min="0" step="any" value={form.defaultBasePrice} onChange={set('defaultBasePrice')} /></div>
            <div className="field"><label>Timer (seconds, 0 = off)</label><input type="number" min="0" max="3600" step="1" value={form.defaultTimerSeconds} onChange={set('defaultTimerSeconds')} /></div>
          </div>

          <h2 className="mt">Auction behaviour</h2>
          <div className="form-grid">
            <div className="field full"><label>Auction Name</label><input value={form.auctionName} onChange={set('auctionName')} /></div>
            <div className="field"><label>Bid button 1 (₹)</label><input type="number" min="1" step="any" value={form.bidIncrement} onChange={set('bidIncrement')} required /><span className="help">Each team gets a +button of this amount, e.g. +500.</span></div>
            <div className="field"><label>Bid button 2 (₹)</label><input type="number" min="1" step="any" value={form.bidIncrement2 ?? 1000} onChange={set('bidIncrement2')} required /><span className="help">Second +button, e.g. +1000.</span></div>
            <div className="field"><label>Maximum sold price (₹)</label><input type="number" min="0" step="any" value={form.maxBid} onChange={set('maxBid')} /><span className="help">0 = no limit.</span></div>
            <div className="field full">
              <label>Auction order</label>
              <select value={form.auctionOrder || 'random'} onChange={set('auctionOrder')}>
                <option value="random">Random: any remaining player (e.g. #7, #18, #1, #5 …)</option>
                <option value="number">By number: #1, #2, #3 …</option>
              </select>
            </div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={!!form.autoNextPlayer} onChange={set('autoNextPlayer')} /> Auto next player: after SOLD / UNSOLD the next player comes up automatically</label>
            </div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={form.showBidsOnLive !== false} onChange={set('showBidsOnLive')} /> Show bid amounts on the public live screen</label>
              <span className="help">When off, the audience sees only the player, timer and the leading team name. Bid amounts, the bid list and the sold price stay hidden. The admin console always shows them.</span>
            </div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={form.showPricesOnLiveTeams === true} onChange={set('showPricesOnLiveTeams')} /> Show sold prices on the live screen's Teams tab</label>
              <span className="help">When on, each player in a team card shows the price they were bought for, plus the team's total spent. When off, only names are shown.</span>
            </div>
            <div className="field"><label>Rest between players (seconds)</label><input type="number" min="0" max="120" step="1" value={form.autoNextDelaySeconds ?? 5} onChange={set('autoNextDelaySeconds')} /><span className="help">Pause after SOLD / UNSOLD before the next player appears. 0 = no pause.</span></div>
            <div className="field full">
              <label className="toggle"><input type="checkbox" checked={!!form.allowPreviousTeamRebid} onChange={set('allowPreviousTeamRebid')} /> Allow the previous team to buy back a released player</label>
            </div>
          </div>
          <div className="modal-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>

        <div className="stack">
          <SoundSettings sounds={form.sounds || {}} onChange={(sounds) => setForm((f) => ({ ...f, sounds }))} />
          <p className="small muted" style={{ margin: '-.4rem 0 0' }}>Music URLs are saved with the <strong>Save settings</strong> button on the left.</p>
          <div className="card">
            <h2>How a round works</h2>
            <ol className="muted" style={{ paddingLeft: '1.2rem', margin: 0 }}>
              <li>Players are called in <strong>{(form.auctionOrder || 'random') === 'random' ? 'random order' : 'player-number order (#1, #2, #3 …)'}</strong>.</li>
              <li>Each player starts at the round's base price{form.roundConfigs[0] ? ` (Round ${form.roundConfigs[0].round}: ${inr(form.roundConfigs[0].basePrice)})` : ''} and the countdown starts.</li>
              <li>Teams bid out loud. When bidding ends, select the winning team, enter the final price and press <strong>SOLD</strong>, or press <strong>UNSOLD</strong>.</li>
              <li>The next player appears automatically. When the round is finished, start the re-auction round: unsold players come back at that round's base price.</li>
            </ol>
          </div>
          <div className="card danger-zone">
            <h2>Reset auction</h2>
            <p className="small muted" style={{ marginTop: 0 }}>Fresh start: all auction records, bids and rounds are cleared, every player becomes Available again and every team's budget is restored. Players, teams, captains, photos and these settings are kept. Use this after a test run, before the real auction.</p>
            <label className="toggle" style={{ marginBottom: '.6rem' }}><input type="checkbox" checked={keepSpecial} onChange={(e) => setKeepSpecial(e.target.checked)} /> Keep each team's Captain &amp; Icon picks</label>
            <button type="button" className="btn btn-danger" onClick={() => { setResetText(''); setResetOpen(true); }}>🔄 Reset auction…</button>
            {resetResult && (
              <p className="small muted" style={{ marginBottom: 0 }}>Last reset: {resetResult.playersAvailable} players available · {resetResult.picksKept} picks kept · {resetResult.deleted.auctions} auction records, {resetResult.deleted.bids} bids cleared.</p>
            )}
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
