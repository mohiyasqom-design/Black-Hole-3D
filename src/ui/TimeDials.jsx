import React from 'react';
import { fmtClock } from '../utils/math.js';

function Dial({ label, tau, rate, tone }) {
  const a = ((tau % 60) / 60) * Math.PI * 2;
  const x = 20 + Math.sin(a) * 13;
  const y = 20 - Math.cos(a) * 13;
  const r = Math.max(0, Math.min(1, rate));
  const arc = 2 * Math.PI * 17;
  return (
    <figure className={`dial ${tone || ''}`}>
      <svg viewBox="0 0 40 40" width="46" height="46" aria-hidden="true">
        <circle cx="20" cy="20" r="17" className="dial-ring" />
        <circle cx="20" cy="20" r="17" className="dial-rate" strokeDasharray={`${arc * r} ${arc}`} transform="rotate(-90 20 20)" />
        <line x1="20" y1="20" x2={x} y2={y} className="dial-hand" />
        <circle cx="20" cy="20" r="1.6" className="dial-pin" />
      </svg>
      <figcaption>
        <span className="dial-label">{label}</span>
        <span className="dial-time">{fmtClock(tau)}</span>
        <span className="dial-x">{'\u00D7'}{rate.toFixed(3)}</span>
      </figcaption>
    </figure>
  );
}

/** Relative Time Visualization: idealized Schwarzschild clock rates. */
export default function TimeDials({ t, onInfo }) {
  return (
    <div className="dials">
      <div className="dials-head">
        <span>Relative time</span>
        <button type="button" className="mini-info" onClick={onInfo} aria-label="About relative time">i</button>
      </div>
      <div className="dials-row">
        <Dial label="Distant" tau={t.simTime} rate={1} />
        <Dial label="You" tau={t.tauCam} rate={t.camRate} tone="you" />
        {t.earth.active && <Dial label="Earth" tau={t.earth.tau} rate={t.earth.rate} tone="earth" />}
        {t.probe.active && <Dial label="Probe" tau={t.probe.tau} rate={Math.max(0, 1 - 1 / t.probe.r)} tone="probe" />}
      </div>
    </div>
  );
}
