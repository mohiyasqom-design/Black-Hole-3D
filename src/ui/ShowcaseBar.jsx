import React, { useEffect, useState } from 'react';
import { uiStore } from '../app/stores.js';
import { Icon } from './icons.jsx';

/** Minimal controls in showcase mode; they fade away when you stop touching. */
export default function ShowcaseBar({ engine, t }) {
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    let timer = setTimeout(() => setAwake(false), 2600);
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), 2600);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('pointermove', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('pointermove', wake);
    };
  }, []);
  const exit = () => {
    if (t.recording) engine.toggleRecording();
    engine.setShowcase(false);
    uiStore.set({ showcase: false });
  };
  return (
    <div className={`showbar ${awake || t.recording ? 'awake' : ''}`}>
      <button type="button" className={`chip ${t.recording ? 'rec' : ''}`} onClick={() => engine.toggleRecording()}>
        <Icon name={t.recording ? 'stop' : 'rec'} size={14} fill /> {t.recording ? 'Stop' : 'Record'}
      </button>
      <button type="button" className="chip ghost" onClick={exit}>Exit showcase</button>
    </div>
  );
}
