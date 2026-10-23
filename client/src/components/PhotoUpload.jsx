import { useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { uploadApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

/** Shrinks a photo in the browser (max 600px, JPEG) so uploads stay small. */
async function resizeImage(file, max = 600) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) return file;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob ? new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) {
    return file; // browser cannot decode it (e.g. HEIC) – send as is
  }
}

/**
 * Photo picker: uploads to /api/upload and stores the returned URL in the form,
 * or accepts a pasted external image URL.
 */
export default function PhotoUpload({ value, onChange, name = '', label = 'Photo', square = false }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const small = await resizeImage(file);
      const res = await uploadApi.image(small);
      onChange(res.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="field full">
      <label>{label}</label>
      <div className="photo-upload">
        <Avatar src={value} name={name} size="lg" square={square} />
        <div className="stack grow" style={{ minWidth: 220 }}>
          <div className="flex">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Upload image'}
            </button>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Remove</button>
            )}
          </div>
          <input type="text" placeholder="…or paste an image URL" value={value || ''} onChange={(e) => onChange(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
          <span className="help">PNG, JPG, WEBP up to 3 MB (photo is resized automatically)</span>
        </div>
      </div>
    </div>
  );
}
