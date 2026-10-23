import { useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import ImageCropper from './ImageCropper.jsx';
import { uploadApi } from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';

/**
 * Photo picker: choose a file -> crop dialog -> upload to /api/images (stored in MongoDB)
 * -> stores the returned URL in the form. A pasted external image URL also works.
 * `square` = 1:1 frame (team logos); otherwise 3:4 portrait (player / captain photos).
 */
export default function PhotoUpload({ value, onChange, name = '', label = 'Photo', square = false }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // file waiting in the crop dialog
  const toast = useToast();

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error('Please choose an image file.'); return; }
    setPending(file);
  };

  const upload = async (file) => {
    setPending(null);
    setBusy(true);
    try {
      const res = await uploadApi.image(file);
      onChange(res.url);
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
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
              {busy ? 'Uploading…' : value ? 'Change photo' : 'Upload photo'}
            </button>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Remove</button>
            )}
          </div>
          <input type="text" placeholder="…or paste an image URL" value={value || ''} onChange={(e) => onChange(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
          <span className="help">PNG, JPG, WEBP. You can crop and zoom before uploading.</span>
        </div>
      </div>
      {pending && (
        <ImageCropper
          file={pending}
          aspect={square ? 1 : 3 / 4}
          outputWidth={square ? 500 : 600}
          onDone={upload}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
