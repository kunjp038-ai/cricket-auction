export default function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return total ? <div className="pagination small muted">{total} results</div> : null;
  return (
    <div className="pagination">
      <span className="small muted" style={{ marginRight: 'auto' }}>{total} results · page {page} of {pages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(1)}>«</button>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(pages)}>»</button>
    </div>
  );
}
