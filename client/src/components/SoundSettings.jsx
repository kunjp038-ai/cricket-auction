import { useEffect, useRef, useState } from 'react';
import SoundToggle from './SoundToggle.jsx';
import { SOUND_EVENTS, previewSound, stopAll, saveDeviceSound, removeDeviceSound, getDeviceSoundInfo } from '../utils/sound.js';
import { useToast } from '../hooks/useToast.jsx';

/**
 * Music settings: per event a shared URL (saved in Settings on the server) and/or a music
 * file picked on this device (kept in the browser, works on Vercel without uploads).
 */
export default function SoundSettings({ sounds, onChange }) {
  const toast = useToast();
  const [deviceFiles, setDeviceFiles] = useState({});
  const fileInputs = useRef({});

  const refresh = async () => {
    const entries = await Promise.all(SOUND_EVENTS.map(async (e) => [e.key, await getDeviceSoundInfo(e.key)]));
    setDeviceFiles(Object.fromEntries(entries));
  };
  useEffect(() => { refresh(); }, []);

  const pick = async (key, file) => {
    if (!file) return;
    if (!/^audio\//.test(file.type)) { toast.error('Please choose an audio file (MP3, WAV, OGG, M4A).'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Keep music files under 15 MB.'); return; }
    try {
      await saveDeviceSound(key, file);
      await refresh();
      toast.success(`${file.name} saved on this device`);
    } catch (e) { toast.error('Could not save the file in this browser.'); }
  };

  const clearDevice = async (key) => { await removeDeviceSound(key); await refresh(); };

  const preview = async (key) => {
    const how = await previewSound(key, deviceFiles[key] ? null : sounds?.[key]);
    if (how === 'blocked') toast.warning('Click anywhere on the page first, then preview again.');
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Music &amp; sounds</h2>
        <SoundToggle />
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Built-in music plays by default. To use your own music, paste a direct MP3 link (shared with every screen) or choose a file from this device (kept in this browser only, so set it on the laptop that runs the auction / projector).
      </p>
      <div className="stack">
        {SOUND_EVENTS.map((ev) => (
          <div key={ev.key} className="card" style={{ padding: '.8rem 1rem', boxShadow: 'none' }}>
            <div className="flex between flex-wrap">
              <div>
                <strong>{ev.label}</strong>
                <div className="small muted">{ev.hint}</div>
              </div>
              <div className="flex gap-sm">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => preview(ev.key)}>▶ Preview</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={stopAll}>■</button>
              </div>
            </div>
            <div className="form-grid mt" style={{ gap: '.6rem' }}>
              <div className="field">
                <label>Music URL (shared)</label>
                <input placeholder="https://…/music.mp3" value={sounds?.[ev.key] || ''} onChange={(e) => onChange({ ...sounds, [ev.key]: e.target.value })} />
              </div>
              <div className="field">
                <label>File on this device</label>
                <div className="flex gap-sm flex-wrap">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputs.current[ev.key]?.click()}>Choose file</button>
                  {deviceFiles[ev.key] ? (
                    <>
                      <span className="badge badge-success">{deviceFiles[ev.key].name}</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearDevice(ev.key)}>Remove</button>
                    </>
                  ) : <span className="small muted">{sounds?.[ev.key] ? 'Using URL' : 'Using built-in music'}</span>}
                  <input ref={(el) => { fileInputs.current[ev.key] = el; }} type="file" accept="audio/*" hidden onChange={(e) => { pick(ev.key, e.target.files?.[0]); e.target.value = ''; }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
