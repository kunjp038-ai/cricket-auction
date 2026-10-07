import { statusTone } from '../utils/format.js';

export default function Badge({ status, tone, children }) {
  const t = tone || statusTone(status);
  return <span className={`badge badge-${t}`}>{children ?? status}</span>;
}
