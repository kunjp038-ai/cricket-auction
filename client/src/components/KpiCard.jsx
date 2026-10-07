export default function KpiCard({ label, value, icon, tone = '', onClick }) {
  return (
    <div className={`card kpi tone-${tone} ${onClick ? 'row-click' : ''}`} onClick={onClick}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {icon && <span className="icon">{icon}</span>}
    </div>
  );
}
