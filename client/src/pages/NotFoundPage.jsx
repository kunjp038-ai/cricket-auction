import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="login-page">
      <div className="card text-center">
        <div style={{ fontSize: '3rem' }}>🏏</div>
        <h1>Page not found</h1>
        <p className="muted">That delivery went wide.</p>
        <Link to="/" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
