export default function EmptyState({ icon = '🏏', title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <strong>{title}</strong>
      {children && <div className="mt">{children}</div>}
    </div>
  );
}
