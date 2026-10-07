export default function Spinner({ full = false }) {
  if (full) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }
  return <div className="spinner" />;
}
