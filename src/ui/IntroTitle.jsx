import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';

export default function IntroTitle() {
  const done = useStore(uiStore, (s) => s.introDone);
  return (
    <div className={`intro ${done ? 'gone' : ''}`} aria-hidden={done}>
      <div className="intro-inner">
      <h1>
        <span className="b1">Black Hole</span>
        <span className="b2">Laboratory</span>
      </h1>
      <p>Interactive Gravity Experience</p>
      <p className="intro-note">Physically inspired visualization</p>
      </div>
    </div>
  );
}
