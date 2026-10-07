import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';

export default function PlayerCard({ player, onClick, action }) {
  return (
    <div className={`card player-card ${onClick ? 'row-click' : ''}`} onClick={onClick}>
      <Avatar src={player.photo} name={player.name} />
      <div className="info">
        <strong>{player.playerNo != null && <span className="player-no sm" style={{ marginRight: 6 }}>#{player.playerNo}</span>}{player.name}</strong>
        <span className="small muted">
          {player.playerType} · {player.battingStyle}
          {player.bowlingStyle && player.bowlingStyle !== 'None' ? ` · ${player.bowlingStyle}` : ''}
        </span>
        <div className="flex gap-sm" style={{ marginTop: 4 }}>
          <Badge status={player.status} />
        </div>
      </div>
      {action}
    </div>
  );
}
