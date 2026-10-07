import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import Spinner from '../components/Spinner.jsx';
import { playersApi, settingsApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

const EMPTY = {
  name: '', phone: '', playerType: 'Batsman', battingStyle: 'Right Hand', bowlingStyle: 'None',
  tshirtSize: 'M', address: '', photo: '', basePrice: 2000, status: 'Available',
};

export default function PlayerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([playersApi.meta(), settingsApi.get(), isEdit ? playersApi.get(id) : null])
      .then(([m, s, p]) => {
        setMeta(m);
        if (p) {
          const player = p.player;
          setOriginal(player);
          setForm({
            name: player.name, phone: player.phone, playerType: player.playerType, battingStyle: player.battingStyle,
            bowlingStyle: player.bowlingStyle, tshirtSize: player.tshirtSize, address: player.address || '',
            photo: player.photo || '', basePrice: player.basePrice, status: player.status,
          });
        } else {
          setForm((f) => ({ ...f, basePrice: s.settings.defaultBasePrice }));
        }
      })
      .catch((e) => toast.error(e.message));
  }, [id, isEdit, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^(?:[6-9]\d{9}|\+?\d{10,15})$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit phone number';
    if (Number(form.basePrice) < 0 || form.basePrice === '') errs.basePrice = 'Base price must be a positive number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = { ...form, basePrice: Number(form.basePrice), phone: form.phone.trim(), name: form.name.trim() };
      if (isEdit && original?.status === 'Sold') delete payload.status; // status of a sold player can only change via release
      const res = isEdit ? await playersApi.update(id, payload) : await playersApi.create(payload);
      toast.success(res.message);
      navigate(`/players/${res.player._id}`);
    } catch (err) {
      toast.error(err.message);
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    } finally {
      setBusy(false);
    }
  };

  if (!meta) return <Spinner full />;
  const soldLocked = isEdit && original?.status === 'Sold';

  return (
    <>
      <PageHeader title={isEdit ? `Edit ${original?.name || 'Player'}` : 'Add Player'} subtitle={isEdit ? 'Update player details' : 'Register a new player for the auction'} />
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>Player Name <span className="req">*</span></label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Virat Patel" required />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label>Phone Number <span className="req">*</span></label>
            <input value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" inputMode="tel" required />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>
          <div className="field">
            <label>Player Type <span className="req">*</span></label>
            <select value={form.playerType} onChange={set('playerType')}>{meta.playerTypes.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field">
            <label>Batting Style <span className="req">*</span></label>
            <select value={form.battingStyle} onChange={set('battingStyle')}>{meta.battingStyles.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field">
            <label>Bowling Style <span className="req">*</span></label>
            <select value={form.bowlingStyle} onChange={set('bowlingStyle')}>{meta.bowlingStyles.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field">
            <label>T-Shirt Size <span className="req">*</span></label>
            <select value={form.tshirtSize} onChange={set('tshirtSize')}>{meta.tshirtSizes.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field">
            <label>Base Price (₹) <span className="req">*</span></label>
            <input type="number" min="0" step="100" value={form.basePrice} onChange={set('basePrice')} required />
            {errors.basePrice && <span className="error-text">{errors.basePrice}</span>}
          </div>
          <div className="field">
            <label>Player Status</label>
            <select value={form.status} onChange={set('status')} disabled={soldLocked}>
              {meta.statuses.map((t) => <option key={t} value={t} disabled={t === 'Sold'}>{t}</option>)}
            </select>
            <span className="help">{soldLocked ? 'Sold players change status only through Release.' : 'Sold is set automatically by the auction.'}</span>
          </div>
          <div className="field full">
            <label>Address</label>
            <textarea value={form.address} onChange={set('address')} placeholder="Full address" />
          </div>
          <PhotoUpload value={form.photo} name={form.name} onChange={(v) => setForm((f) => ({ ...f, photo: v }))} label="Player Photo" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add player'}</button>
        </div>
      </form>
    </>
  );
}
