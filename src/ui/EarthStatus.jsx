import React from 'react';
import { fmt } from '../utils/math.js';

const TONES = ['calm', 'calm', 'warn', 'warn', 'hot', 'hot'];

export default function EarthStatus({ t, engine }) {
  const e = t.earth;
  if (!e.present) return null;
  if (!e.active) {
    const msg = e.fate === 'destroyed' ? 'Earth was torn apart by tides.' : e.fate === 'swallowed-intact' ? 'Earth crossed the horizon in one piece.' : 'Earth fell through the horizon.';
    return (
      <section className="earth-status gone" aria-live="polite">
        <p className="es-stage">{msg}</p>
        <div className="es-actions">
          <button type="button" className="chip" onClick={() => engine.respawnEarth()}>Respawn Earth</button>
          <button type="button" className="chip ghost" onClick={() => engine.removeEarth()}>Dismiss</button>
        </div>
      </section>
    );
  }
  const stress = Math.min(1.25, e.stress);
  return (
    <section className={`earth-status tone-${TONES[e.stage]}`} aria-live="polite">
      <div className="es-head">
        <span className="es-kicker">Earth</span>
        <span className="es-stage">{e.stageName}</span>
      </div>
      <div className="meter" aria-label={`Tidal stress ${Math.round(e.stress * 100)} percent of disruption`}>
        <span style={{ transform: `scaleX(${stress / 1.25})` }} />
        <i style={{ left: `${(1 / 1.25) * 100}%` }} />
      </div>
      <p className="es-nums">
        {e.r.toFixed(1)} r{'\u209B'} {'\u00B7'} {(e.vC * 100).toFixed(1)}% c {'\u00B7'} tides {fmt(e.tidalG)} g
      </p>
      {t.compressed && <p className="es-note">Real tidal radius {fmt(t.rtReal)} r{'\u209B'}, compressed to {t.rtScene.toFixed(0)} r{'\u209B'} to fit the lab.</p>}
      {!t.compressed && t.rtReal < 1 && <p className="es-note">Tidal radius lies inside the horizon: Earth can fall in intact.</p>}
    </section>
  );
}
