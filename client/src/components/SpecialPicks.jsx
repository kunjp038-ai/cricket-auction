import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import { playersApi, settingsApi, teamsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { inr, roleLabel } from '../utils/format.js';

const ROLES = [
  { role: 'Captain', icon: '©️', priceKey: 'captainPrice' },
  { role: 'Icon', icon: '⭐', priceKey: 'iconPrice' },
];

/**
 * Captain & Icon: two fixed-price players every team picks before the auction.
 * Assigning deducts the fixed price from the team budget; removing refunds it and puts
 * the player back in the auction pool.
 */
export default function SpecialPicks({ team, squad, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [settings, setSettings] = useState(null);
  const [pool, setPool] = useState([]);
  const [choice, setChoice] = useState({ Captain: '', Icon: '' });
  const [busy, setBusy] = useState('');

  const loadPool = () =>
    playersApi.list({ status: 'Available,Re-Auction,Released,Unsold', limit: 500, sort: 'playerNo' })
      .then((r) => setPool(r.items)).catch(() => {});

  useEffect(() => {
    settingsApi.get().then((r) => setSettings(r.settings)).catch(() => {});
    loadPool();
  }, [team._id, squad.length]);

  const assign = async (role) => {
    const playerId = choice[role];
    if (!playerId) { toast.warning('Select a player first'); return; }
    const p = pool.find((x) => x._id === playerId);
    const price = settings?.[ROLES.find((r) => r.role === role).priceKey] || 0;
    const ok = await confirm({
      title: `Make ${p?.name} the ${role}?`,
      message: `${p?.name} joins ${team.name} as ${role} for the fixed price of ${inr(price)}. This is deducted from the team budget now.`,
      confirmText: `Assign ${role}`, tone: 'primary',
    });
    if (!ok) return;
    setBusy(role);
    try {
      const r = await teamsApi.assignSpecial(team._id, role, playerId);
      toast.success(r.message);
      setChoice((c) => ({ ...c, [role]: '' }));
      onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  const remove = async (role, player) => {
    const ok = await confirm({
      title: `Remove ${player.name} as ${role}?`,
      message: `The fixed price is refunded to ${team.name} and ${player.name} goes back into the auction pool.`,
      confirmText: 'Remove', tone: 'danger',
    });
    if (!ok) return;
    setBusy(role);
    try {
      const r = await teamsApi.removeSpecial(team._id, role);
      toast.success(r.message);
      onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  return (
    <div className="card mb">
      <div className="card-title">
        <h2 style={{ margin: 0 }}>Captain &amp; Icon players</h2>
        <span className="small muted">Fixed price, picked before the auction</span>
      </div>
      <div className="grid grid-2">
        {ROLES.map(({ role, icon, priceKey }) => {
          const current = squad.find((p) => p.squadRole === role);
          const price = settings?.[priceKey] ?? 0;
          return (
            <div key={role} className="special-slot">
              <div className="flex between">
                <strong>{icon} {role}</strong>
                <span className="badge badge-info">Fixed {inr(price)}</span>
              </div>
              {current ? (
                <div className="flex" style={{ marginTop: '.6rem' }}>
                  <Avatar src={current.photo} name={current.name} size="lg" square />
                  <div className="grow">
                    <strong>#{current.playerNo ?? '-'} {current.name}</strong>
                    <div className="small muted">{roleLabel(current)} · bought for {inr(current.bidAmount)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => remove(role, current)}>Remove</button>
                </div>
              ) : (
                <div className="stack" style={{ marginTop: '.6rem' }}>
                  <select value={choice[role]} onChange={(e) => setChoice((c) => ({ ...c, [role]: e.target.value }))}>
                    <option value="">— Select {role} player —</option>
                    {pool.map((p) => <option key={p._id} value={p._id}>#{p.playerNo ?? '-'} {p.name} · {roleLabel(p)}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={!!busy || !choice[role]} onClick={() => assign(role)}>
                    {busy === role ? 'Saving…' : `Assign ${role} (${inr(price)})`}
                  </button>
                  {price === 0 && <span className="help">Set the {role} price in Settings → Captain &amp; Icon price.</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
