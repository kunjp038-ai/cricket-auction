import { assetUrl } from '../services/api.js';
import { initials } from '../utils/format.js';

export default function Avatar({ src, name = '', size = '', square = false, color }) {
  const style = color ? { borderColor: color } : undefined;
  return (
    <span className={`avatar ${size} ${square ? 'square' : ''}`} style={style} title={name}>
      {src ? <img src={assetUrl(src)} alt={name} loading="lazy" /> : initials(name) || '?'}
    </span>
  );
}
