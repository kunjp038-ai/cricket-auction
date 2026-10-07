import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { authApi } from '../services/api.js';

export default function LoginPage() {
  const { login, setup, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.setupStatus().then((r) => setNeedsSetup(r.needsSetup)).catch(() => {});
  }, []);

  if (!loading && isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (needsSetup) await setup(form);
      else await login(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card stack" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-logo" />
          <div>
            <h1 style={{ fontSize: '1.2rem' }}>Cricket Player Auction</h1>
            <span className="small muted">{needsSetup ? 'Create the first admin account' : 'Admin login'}</span>
          </div>
        </div>
        {needsSetup && (
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Please wait…' : needsSetup ? 'Create admin & sign in' : 'Sign in'}
        </button>
        <a href="/live" className="small muted text-center">Open public live screen →</a>
      </form>
    </div>
  );
}
