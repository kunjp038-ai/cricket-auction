import Avatar from './Avatar.jsx';
import BudgetBar from './BudgetBar.jsx';
import { inr } from '../utils/format.js';

/**
 * Team card used on the auction screen (with BID button) and the teams list.
 */
export default function TeamCard({ team, highest = false, onBid, bidDisabled, bidLabel, footer, onClick }) {
  const playerCount = team.playerCount ?? team.players?.length ?? 0;
  return (
    <div
      className={`card team-card ${highest ? 'highest' : ''} ${onClick ? 'row-click' : ''}`}
      style={{ '--team-color': team.color || '#38bdf8' }}
      onClick={onClick}
    >
      {highest && <span className="crown">HIGHEST BIDDER</span>}
      <div className="head">
        <Avatar src={team.logo} name={team.name} square color={team.color} />
        <div className="grow" style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</strong>
          <span className="small muted">
            {team.captain?.name ? `C: ${team.captain.name} · ` : ''}
            {playerCount}/{team.maxPlayers} players
          </span>
        </div>
      </div>
      <div>
        <div className="small muted">Remaining</div>
        <div className="amount">{inr(team.remainingBudget)}</div>
      </div>
      <BudgetBar total={team.totalBudget} used={team.usedBudget} showLabels={false} />
      <div className="flex between small muted">
        <span>Used {inr(team.usedBudget)}</span>
        <span>Budget {inr(team.totalBudget)}</span>
      </div>
      {onBid && (
        <button
          className={`btn btn-block ${highest ? 'btn-accent' : 'btn-primary'}`}
          disabled={bidDisabled}
          onClick={(e) => { e.stopPropagation(); onBid(team); }}
        >
          {bidLabel || 'BID'}
        </button>
      )}
      {footer}
    </div>
  );
}
