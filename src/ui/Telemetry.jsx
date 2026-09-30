import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';
import { fmt } from '../utils/math.js';
import TimeDials from './TimeDials.jsx';
import { Icon } from './icons.jsx';

function Row({ k, v, u }) {
  return (
    <div className="row">
      <dt>{k}</dt>
      <dd>
        {v}
        {u ? <small>{u}</small> : null}
      </dd>
    </div>
  );
}

export default function Telemetry({ t }) {
  const open = useStore(uiStore, (s) => s.telemetryOpen);
  return (
    <section className={`telemetry ${open ? 'open' : ''}`} aria-label="Live data">
      <button type="button" className="tele-sum" onClick={() => uiStore.set({ telemetryOpen: !open })} aria-expanded={open}>
        <span className="pill">{t.typeLabel}</span>
        <span>M {fmt(t.mass)} M{'\u2609'}</span>
        <span>a* {t.spin.toFixed(2)}</span>
        <span className="fps">{Math.round(t.fps)} fps</span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="tele-body">
          <dl>
            <Row k="Mass" v={fmt(t.mass)} u={'M\u2609'} />
            <Row k="Schwarzschild radius" v={fmt(t.rsKm)} u="km" />
            <Row k="Spin a*" v={t.spin.toFixed(3)} />
            <Row k={'Horizon r\u208A'} v={fmt(t.horizonKm)} u="km" />
            <Row k="ISCO" v={t.isco.toFixed(2)} u={'r\u209B'} />
            <Row k="Camera distance" v={fmt(t.camRs)} u={`r\u209B \u00B7 ${fmt(t.camKm)} km`} />
            <Row k="Disk peak temp (est.)" v={fmt(t.diskTempReal)} u="K" />
            {t.earth.active && <Row k="Earth distance" v={t.earth.r.toFixed(2)} u={'r\u209B'} />}
            {t.earth.active && <Row k="Orbital velocity" v={fmt(t.earth.vKms)} u={`km/s \u00B7 ${(t.earth.vC * 100).toFixed(1)}% c`} />}
            {t.earth.active && <Row k="Tidal acceleration" v={fmt(t.earth.tidalAcc)} u={`m/s\u00B2 \u00B7 ${fmt(t.earth.tidalG)} g`} />}
            <Row k="Simulation time" v={t.simTime.toFixed(1)} u="s" />
            <Row k="Quality" v={t.quality} u={`${t.res}% res`} />
            <Row k="Assets" v={t.assets} u={t.safeMode ? 'safe shaders' : ''} />
          </dl>
          <TimeDials t={t} onInfo={() => uiStore.set({ card: 'time' })} />
        </div>
      )}
    </section>
  );
}
