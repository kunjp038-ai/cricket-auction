import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useAuctionSocket } from '../hooks/useAuctionSocket.js';

const NAV = [
  { section: 'Auction' },
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/auction', label: 'Live Auction', icon: '🔨' },
  { to: '/pool', label: 'Unsold / Released', icon: '♻️' },
  { to: '/rounds', label: 'Rounds', icon: '🔁' },
  { to: '/history', label: 'Auction History', icon: '📜' },
  { section: 'Manage' },
  { to: '/players', label: 'Players', icon: '🏏' },
  { to: '/teams', label: 'Teams', icon: '🛡️' },
  { to: '/captains', label: 'Captains', icon: '🎖️' },
  { to: '/settings', label: 'Bid Rules', icon: '⚙️' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { connected, socketDisabled } = useAuctionSocket();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="app">
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <h1>Cricket Auction</h1>
            <span className="small muted">Admin Console</span>
          </div>
        </div>
        <nav className="nav stack gap-sm">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
          <a href="/live" target="_blank" rel="noreferrer">
            <span className="icon">📺</span>Public Live Screen ↗
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="small muted">Signed in as</div>
          <div className="flex between">
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name}</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon hamburger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            ☰
          </button>
          <strong className="grow">Cricket Player Auction</strong>
          <span className="small muted flex gap-sm">
            <span className={`live-dot ${connected || socketDisabled ? 'on' : ''}`} /> {connected ? 'Live' : socketDisabled ? 'Live (polling)' : 'Offline'}
          </span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
