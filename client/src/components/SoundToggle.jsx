import { useEffect, useState } from 'react';
import { isSoundEnabled, setSoundEnabled, unlockAudio, isAudioReady, getVolume, setVolume, playEvent } from '../utils/sound.js';

/** 🔊 / 🔇 button with a volume slider. Clicking also unlocks audio (browsers need a user gesture). */
export default function SoundToggle({ showVolume = true }) {
  const [on, setOn] = useState(isSoundEnabled());
  const [ready, setReady] = useState(isAudioReady());
  const [vol, setVol] = useState(getVolume());

  useEffect(() => {
    const id = setInterval(() => setReady(isAudioReady()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    if (next) {
      unlockAudio();
      setTimeout(() => { setReady(isAudioReady()); playEvent('start'); }, 50);
    }
  };

  const needsClick = on && !ready;
  return (
    <span className="flex gap-sm">
      <button
        type="button"
        className={`btn btn-sm ${needsClick ? 'btn-accent' : 'btn-ghost'}`}
        onClick={toggle}
        title={on ? 'Music on (click to mute)' : 'Music off (click to enable)'}
      >
        {on ? '🔊' : '🔇'} {needsClick ? 'Click to enable music' : on ? 'Music on' : 'Music off'}
      </button>
      {showVolume && on && (
        <input
          type="range" min="0" max="1" step="0.05" value={vol} title="Volume"
          onChange={(e) => { setVol(Number(e.target.value)); setVolume(e.target.value); }}
          style={{ width: 90, padding: 0 }}
        />
      )}
    </span>
  );
}
