import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';
import { Icon } from './icons.jsx';

export default function Dock({ engine, t }) {
  const panel = useStore(uiStore, (s) => s.panel);
  const earthOn = t.earth.active;
  return (
    <nav className="dock" aria-label="Primary actions">
      <button type="button" className={`dock-btn ${earthOn ? 'on' : ''}`} onClick={() => (earthOn ? engine.setCameraMode('earth') : engine.addEarth())}>
        <Icon name="earth" />
        <span>{earthOn ? 'Follow Earth' : 'Add Earth'}</span>
      </button>
      <button type="button" className="dock-btn" onClick={() => engine.dropProbe()}>
        <Icon name="probe" />
        <span>Drop probe</span>
      </button>
      <button type="button" className="enter" onClick={() => engine.enter()}>
        <span className="enter-ring" aria-hidden="true" />
        <span className="enter-text">Enter<br />Black Hole</span>
      </button>
      <button type="button" className={`dock-btn ${t.touring ? 'on' : ''}`} onClick={() => (t.touring ? engine.stopTour() : engine.startTour({ loop: false }))}>
        <Icon name={t.touring ? 'stop' : 'tour'} />
        <span>{t.touring ? 'Stop tour' : 'Cinematic'}</span>
      </button>
      <button type="button" className={`dock-btn ${panel ? 'on' : ''}`} aria-expanded={panel} onClick={() => uiStore.set({ panel: !panel })}>
        <Icon name="sliders" />
        <span>Lab</span>
      </button>
    </nav>
  );
}
