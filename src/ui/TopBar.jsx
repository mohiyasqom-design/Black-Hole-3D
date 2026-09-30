import React, { useRef } from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';
import { Icon } from './icons.jsx';

export default function TopBar({ engine }) {
  const sound = useStore(uiStore, (s) => s.sound);
  const science = useStore(uiStore, (s) => s.science);
  const press = useRef(null);

  const toggleSound = async () => {
    const next = !sound;
    const ok = await engine.setSound(next);
    uiStore.set({ sound: next && ok !== false });
  };
  // Hidden: hold the title for 1.6 s to summon Gargantua (touch-friendly Konami).
  const down = () => {
    clearTimeout(press.current);
    press.current = setTimeout(() => engine.gargantua(), 1600);
  };
  const up = () => clearTimeout(press.current);

  return (
    <header className="topbar">
      <div className="brand" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}>
        <h1>
          <span className="b1">Black Hole</span>
          <span className="b2">Laboratory</span>
        </h1>
        <p className="tag">Interactive Gravity Experience</p>
      </div>
      <nav className="tools" aria-label="Tools">
        <button type="button" className={`tool ${science ? 'on' : ''}`} aria-pressed={science} onClick={() => uiStore.set({ science: !science, card: null })} title="Science mode (S)">
          <Icon name="science" />
          <span>Science</span>
        </button>
        <button type="button" className={`tool ${sound ? 'on' : ''}`} aria-pressed={sound} onClick={toggleSound} title="Sound (M)">
          <Icon name={sound ? 'sound' : 'mute'} />
          <span>{sound ? 'Sound on' : 'Sound off'}</span>
        </button>
        <button type="button" className="tool" onClick={() => engine.capturePhoto()} title="Photo (P)">
          <Icon name="camera" />
          <span>Photo</span>
        </button>
        <button type="button" className="tool" onClick={() => { uiStore.set({ showcase: true, panel: false }); engine.setShowcase(true); }} title="Showcase mode for recording">
          <Icon name="film" />
          <span>Showcase</span>
        </button>
        <button type="button" className="tool" onClick={() => uiStore.set({ hidden: true, panel: false })} title="Hide interface (H)">
          <Icon name="eyeOff" />
          <span>Hide UI</span>
        </button>
      </nav>
    </header>
  );
}
