import { inr, pct } from '../utils/format.js';

export default function BudgetBar({ total, used, showLabels = true }) {
  const p = pct(used, total);
  const cls = p >= 90 ? 'hot' : p >= 70 ? 'warn' : '';
  return (
    <div>
      {showLabels && (
        <div className="flex between small muted" style={{ marginBottom: 4 }}>
          <span>Used {inr(used)}</span>
          <span>{p}%</span>
          <span>Total {inr(total)}</span>
        </div>
      )}
      <div className={`bar ${cls}`}>
        <span style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
