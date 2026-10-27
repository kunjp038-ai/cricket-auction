import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Simple crop dialog: the photo sits inside a fixed frame (aspect = width/height).
 * Drag to move, use the slider (or mouse wheel / pinch) to zoom. "Crop & Upload" returns a
 * JPEG File of the visible area, scaled to `outputWidth`.
 */
export default function ImageCropper({ file, aspect = 3 / 4, outputWidth = 600, onDone, onCancel }) {
  const [src, setSrc] = useState('');
  const [orig, setOrig] = useState(null); // decoded original image
  const [rot, setRot] = useState(0); // 0 | 90 | 180 | 270
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of image centre from frame centre (frame px)
  const frameRef = useRef(null);
  const drag = useRef(null);
  const pinch = useRef(null);

  const frameW = 320;
  const frameH = Math.round(frameW / aspect);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    const im = new Image();
    im.onload = () => { setOrig(im); setRot(0); setZoom(1); setPos({ x: 0, y: 0 }); };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Pre-rotate the original into a canvas; everything below works on the rotated image.
  const img = useMemo(() => {
    if (!orig) return null;
    const swap = rot === 90 || rot === 270;
    const c = document.createElement('canvas');
    c.width = swap ? orig.height : orig.width;
    c.height = swap ? orig.width : orig.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(orig, -orig.width / 2, -orig.height / 2);
    return c;
  }, [orig, rot]);
  const viewSrc = useMemo(() => (img ? img.toDataURL('image/jpeg', 0.9) : ''), [img]);

  const rotate = (delta) => {
    setRot((r) => (r + delta + 360) % 360);
    setZoom(1);
    setPos({ x: 0, y: 0 });
  };

  if (!file) return null;

  // Scale so the image fully covers the frame at zoom 1.
  const base = img ? Math.max(frameW / img.width, frameH / img.height) : 1;
  const scale = base * zoom;
  const drawW = img ? img.width * scale : 0;
  const drawH = img ? img.height * scale : 0;

  const clamp = (p, z = zoom) => {
    const s = base * z;
    const maxX = Math.max(0, (img.width * s - frameW) / 2);
    const maxY = Math.max(0, (img.height * s - frameH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current || !img) return;
    setPos(clamp({ x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) }));
  };
  const onPointerUp = () => { drag.current = null; };
  const onWheel = (e) => {
    e.preventDefault();
    const z = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    setZoom(z);
    setPos((p) => clamp(p, z));
  };
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const z = Math.min(4, Math.max(1, pinch.current.z * (d / pinch.current.d)));
      setZoom(z);
      setPos((p) => clamp(p, z));
    }
  };

  const crop = async () => {
    if (!img) return;
    const outW = outputWidth;
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    // Visible region in image pixels
    const sx = (drawW / 2 - frameW / 2 - pos.x) / scale;
    const sy = (drawH / 2 - frameH / 2 - pos.y) / scale;
    const sw = frameW / scale;
    const sh = frameH / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    onDone(new File([blob], name, { type: 'image/jpeg' }));
  };

  const useFull = async () => {
    // No crop: just downscale the whole image.
    if (!img) return;
    const s = Math.min(1, outputWidth / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * s);
    canvas.height = Math.round(img.height * s);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    onDone(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
  };

  return (
    <Modal open onClose={onCancel} title="Crop photo" size="sm">
      <p className="small muted" style={{ marginTop: 0 }}>Drag the photo to position it. Use the slider, mouse wheel or pinch to zoom. Rotate if the photo is sideways.</p>
      <div
        ref={frameRef}
        className="crop-frame"
        style={{ width: frameW, height: frameH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        {img && (
          <img
            src={viewSrc}
            alt=""
            draggable={false}
            style={{
              width: drawW,
              height: drawH,
              transform: `translate(${frameW / 2 - drawW / 2 + pos.x}px, ${frameH / 2 - drawH / 2 + pos.y}px)`,
            }}
          />
        )}
        <div className="crop-grid" />
      </div>
      <div className="flex" style={{ marginTop: '.8rem', justifyContent: 'center' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => rotate(-90)} title="Rotate left">↺ Rotate left</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => rotate(90)} title="Rotate right">↻ Rotate right</button>
      </div>
      <div className="flex" style={{ marginTop: '.6rem' }}>
        <span className="small muted">Zoom</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); setPos((p) => clamp(p, z)); }} style={{ padding: 0 }} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-ghost" onClick={useFull}>Use full photo</button>
        <button type="button" className="btn btn-primary" onClick={crop} disabled={!img}>✂️ Crop &amp; Upload</button>
      </div>
    </Modal>
  );
}
