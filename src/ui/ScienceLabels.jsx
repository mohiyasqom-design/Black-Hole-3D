import React, { useEffect, useRef } from 'react';
import { uiStore } from '../app/stores.js';
import { SCIENCE } from '../data/science.js';

const KEYS = ['horizon', 'photon', 'disk', 'jets', 'lensing', 'tidal', 'probe'];

/** 3D-anchored annotations. Positions are written straight to the DOM by the engine each frame. */
export default function ScienceLabels({ engine }) {
  const refs = useRef({});
  useEffect(() => {
    engine.labelSink = (L) => {
      for (const k of KEYS) {
        const el = refs.current[k];
        const l = L[k];
        if (!el || !l) continue;
        if (l.visible) {
          el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        } else {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      }
    };
    return () => {
      engine.labelSink = null;
    };
  }, [engine]);
  return (
    <div className="labels" aria-label="Science annotations">
      {KEYS.map((k) => (
        <button key={k} type="button" className="label" ref={(el) => { refs.current[k] = el; }} onClick={() => uiStore.set({ card: k })}>
          <i />
          <span>{SCIENCE[k].title}</span>
        </button>
      ))}
    </div>
  );
}
