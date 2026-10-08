import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import Spinner from './Spinner.jsx';
import { teamsApi } from '../services/api.js';

/**
 * Public "Teams" view for the live screen: every team with its captain and the players it
 * has bought. Deliberately shows no prices or budgets. Refreshes every few seconds.
 */
export default function LiveSquads() {
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () => teamsApi.squads()
      .then((r) => { if (alive) { setTeams(r.teams); setError(''); } })
      .catch((e) => { if (alive) setError(e.message); });
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!teams) return error ? <div className="card error-text">{error}</div> : <Spinner />;
  if (teams.length === 0) return <div className="card text-center muted">No teams yet.</div>;

  return (
    <div className="squads-grid">
      {teams.map((t) => (
        <div key={t._id} className="card squad-card" style={{ '--team-color': t.color || '#38bdf8' }}>
          <div className="squad-head">
            <Avatar src={t.logo} name={t.name} square color={t.color} />
            <div className="grow" style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{t.name}</h2>
              <div className="small muted">{t.captain ? `Captain: ${t.captain.name}` : 'Captain: –'} · {t.players.length} player{t.players.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          {t.players.length === 0 ? (
            <p className="muted small" style={{ margin: '.6rem 0 0' }}>No players bought yet.</p>
          ) : (
            <ul className="squad-list">
              {t.players.map((p) => (
                <li key={p._id}>
                  <Avatar src={p.photo} name={p.name} size="sm" />
                  <span className="player-no sm">#{p.playerNo ?? '-'}</span>
                  <span className="grow"><strong>{p.name}</strong><span className="small muted"> · {p.playerType}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
