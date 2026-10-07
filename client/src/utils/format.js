export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-');

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

export const statusTone = (status) => {
  switch (status) {
    case 'Sold':
    case 'SOLD':
      return 'success';
    case 'Unsold':
    case 'UNSOLD':
      return 'danger';
    case 'Re-Auction':
    case 'Released':
      return 'warning';
    case 'LIVE':
      return 'live';
    case 'Available':
    case 'OPEN':
      return 'info';
    default:
      return 'neutral';
  }
};

export const pct = (part, total) => (total ? Math.min(100, Math.round((part / total) * 100)) : 0);
