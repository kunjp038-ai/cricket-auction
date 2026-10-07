import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import PhotoUpload from '../components/PhotoUpload.jsx';
import Spinner from '../components/Spinner.jsx';
import { playersApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

const EMPTY = {
  playerNo: '', name: '', phone: '', playerType: 'Batsman', battingStyle: 'Right Hand', bowlingStyle: 'None',
  tshirtSize: 'M', address: '', photo: '', status: 'Available',
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
    Promise.all([playersApi.meta(), isEdit ? playersApi.get(id) : null])
      .then(([m, p]) => {
        setMeta(m);
        if (p) {
          const player = p.player;
          setOriginal(player);
          setForm({
            playerNo: player.playerNo ?? '', name: player.name, phone: player.phone, playerType: player.playerType,
            battingStyle: player.battingStyle, bowlingStyle: player.bowlingStyle, tshirtSize: player.tshirtSize,
            address: player.address || '', photo: player.photo || '', status: player.status,
          });
        } else {
          setForm((f) => ({ ...f, playerNo: m.nextPlayerNo }));
        }
      })
      .catch((e) => toast.error(e.message));
  }, [id, isEdit, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const validate = () => {
    const errs = {};
    if (!form.playerNo || Number(form.playerNo) < 1) errs.playerNo = 'Player number is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^(?:[6-9]\d{9}|\+?\d{10,15})$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = { ...form, playerNo: Number(form.playerNo), phone: form.phone.trim(), name: form.name.trim() };
      if (isEdit && original?.status === 'Sold') delete payload.status;
      const res = isEdit ? await playersApi.update(id, payload) : await playersApi.create(payload);
      toast.success(res.message);
      if (isEdit) navigate(`/players/${res.player._id}`);
      else {
        // Stay on the form to add the next player quickly.
        const m = await playersApi.meta();
        setForm({ ...EMPTY, playerNo: m.nextPlayerNo });
        setErrors({});
      }
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
      <PageHeader title={isEdit ? `Edit #${original?.playerNo ?? ''} ${original?.name || 'Player'}` : 'Add Player'} subtitle={isEdit ? 'Update player details' : 'Register a new player. The base price comes from the round settings.'} />
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>Player Number <span className="req">*</span></label>
            <input type="number" min="1" value={form.playerNo} onChange={set('playerNo')} required style={{ fontSize: '1.3rem', fontWeight: 700 }} />
            <span className="help">Unique. Players are auctioned in this order.{!isEdit && ` Next free number: ${meta.nextPlayerNo}.`}</span>
            {errors.playerNo && <span className="error-text">{errors.playerNo}</span>}
          </div>
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
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/players')}>{isEdit ? 'Cancel' : 'Done'}</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add player & next'}</button>
        </div>
      </form>
    </>
  );
}
