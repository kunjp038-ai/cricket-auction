import { useEffect, useState } from 'react';
import { isSoundEnabled, setSoundEnabled, unlockAudio, isAudioReady, playTick } from '../utils/sound.js';

/** 🔊 / 🔇 button. Clicking also unlocks audio (browsers need a user gesture). */
export default function SoundToggle({ big = false }) {
  const [on, setOn] = useState(isSoundEnabled());
  const [ready, setReady] = useState(isAudioReady());

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
      setTimeout(() => { setReady(isAudioReady()); playTick(); }, 50);
    }
  };

  const needsClick = on && !ready;
  return (
    <button
      type="button"
      className={`btn ${big ? 'btn-lg' : 'btn-sm'} ${needsClick ? 'btn-accent' : 'btn-ghost'}`}
      onClick={toggle}
      title={on ? 'Timer sound on (click to mute)' : 'Timer sound off (click to enable)'}
    >
      {on ? '🔊' : '🔇'} {needsClick ? 'Click to enable sound' : on ? 'Sound on' : 'Sound off'}
    </button>
  );
}
