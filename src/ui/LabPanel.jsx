import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore, paramStore } from '../app/stores.js';
import { Slider, Segmented, Toggle } from './controls.jsx';
import { Icon } from './icons.jsx';
import { BH_TYPES, VIZ_MODES } from '../data/blackholes.js';
import { RANGES } from '../data/params.js';
import { PRESETS } from '../data/presets.js';
import { fmt } from '../utils/math.js';

const TABS = [
  { id: 'bh', label: 'Black hole' },
  { id: 'earth', label: 'Earth' },
  { id: 'view', label: 'View' },
  { id: 'camera', label: 'Camera' },
  { id: 'presets', label: 'Presets' },
];

function useParam(key) {
  return useStore(paramStore, (s) => s[key]);
}

function P({ k, label, engine, format, tip, step, unit }) {
  const v = useParam(k);
  const science = useStore(uiStore, (s) => s.science);
  const [min, max] = RANGES[k];
  return <Slider label={label} value={v} min={min} max={max} step={step ?? (max - min) / 200} unit={unit} format={format} tip={tip} showTip={science} onChange={(x) => engine.setParams({ [k]: x })} />;
}

function BlackHoleTab({ engine }) {
  const type = useParam('bhType');
  const mass = useParam('mass');
  const science = useStore(uiStore, (s) => s.science);
  const T = BH_TYPES[type];
  const log = T.mass.log;
  return (
    <>
      <Segmented label="Type" value={type} onChange={(v) => engine.setType(v)} options={Object.values(BH_TYPES).map((b) => ({ value: b.id, label: b.label }))} />
      <p className="blurb">{T.blurb}</p>
      <Slider
        label="Mass"
        unit={'M\u2609'}
        value={log ? Math.log10(mass) : mass}
        min={log ? Math.log10(T.mass.min) : T.mass.min}
        max={log ? Math.log10(T.mass.max) : T.mass.max}
        step={log ? 0.01 : 0.5}
        format={(v) => fmt(log ? Math.pow(10, v) : v)}
        tip="Sets the horizon size and, through real tidal physics, how violently Earth is stretched."
        showTip={science}
        onChange={(v) => engine.setParams({ mass: log ? Math.pow(10, v) : v })}
      />
      <P engine={engine} k="spin" label="Spin a*" format={(v) => v.toFixed(3)} tip="Faster spin shrinks the horizon and ISCO, drags spacetime and powers the jets." />
      <P engine={engine} k="diskSpeed" label="Disk speed" format={(v) => `${v.toFixed(2)}\u00D7`} />
      <P engine={engine} k="diskTemp" label="Disk temperature" step={100} format={(v) => `${Math.round(v)} K`} tip="Visual color temperature. Real disks are far hotter and peak outside visible light." />
      <P engine={engine} k="diskDensity" label="Disk density" format={(v) => v.toFixed(2)} />
      <P engine={engine} k="diskExtent" label="Disk extent" step={0.1} format={(v) => `${v.toFixed(1)} r\u209B`} />
      <P engine={engine} k="jetPower" label="Jet power" format={(v) => v.toFixed(2)} tip="Scaled by spin squared, roughly as in the Blandford-Znajek mechanism." />
      <P engine={engine} k="lensing" label="Gravitational distortion" format={(v) => `${Math.round(v * 100)}%`} tip="100% is the physically inspired deflection. Other values are for exploration." />
      <P engine={engine} k="photonRing" label="Photon ring" format={(v) => v.toFixed(2)} />
    </>
  );
}

function EarthTab({ engine, t }) {
  const dir = useParam('earthDirection');
  const e = t.earth;
  return (
    <>
      <div className="actions">
        {!e.active ? (
          <button type="button" className="chip" onClick={() => engine.addEarth()}>Add Earth</button>
        ) : (
          <>
            <button type="button" className="chip" onClick={() => engine.setCameraMode('earth')}>Follow</button>
            <button type="button" className="chip ghost" onClick={() => engine.respawnEarth()}>Respawn</button>
            <button type="button" className="chip ghost" onClick={() => engine.removeEarth()}>Remove</button>
          </>
        )}
      </div>
      <P engine={engine} k="earthDistance" label="Distance" step={0.05} format={(v) => `${v.toFixed(2)} r\u209B`} tip={'Below 3 r\u209B no stable circular orbit exists (the ISCO for a non-spinning hole).'} />
      <P engine={engine} k="earthVelocity" label="Orbital velocity" format={(v) => `${v.toFixed(2)}\u00D7 circular`} tip="Launch speed relative to a circular orbit. Slower means a plunging ellipse, faster a wide one." />
      <P engine={engine} k="earthInclination" label="Inclination" step={1} format={(v) => `${Math.round(v)}\u00B0`} />
      <Segmented label="Direction" value={dir} onChange={(v) => engine.setParams({ earthDirection: v })} options={[{ value: 1, label: 'Prograde' }, { value: -1, label: 'Retrograde' }]} />
      <P engine={engine} k="tidalGain" label="Tidal force" format={(v) => `${v.toFixed(2)}\u00D7`} tip={'Multiplies the deformation response. 1\u00D7 follows the computed tidal radius.'} />
      <h3 className="sub">Experiments</h3>
      <div className="actions">
        <button type="button" className="chip" onClick={() => engine.dropProbe()}>Drop probe</button>
        <button type="button" className="chip" onClick={() => engine.gwPulse()}>Gravitational wave</button>
        <button type="button" className="chip" onClick={() => engine.extremeTidal()}>Extreme tides</button>
      </div>
    </>
  );
}

function ViewTab({ engine, t }) {
  const viz = useParam('vizMode');
  const grid = useParam('grid');
  const orbit = useParam('orbitPath');
  const paused = useParam('paused');
  const quality = useParam('quality');
  return (
    <>
      <Segmented label="Visualization" value={viz} onChange={(v) => engine.setParams({ vizMode: v, eht: false })} options={VIZ_MODES.map((m) => ({ value: m.id, label: m.label }))} />
      {viz === 2 && <p className="legend"><i className="lg-blue" /> approaching <i className="lg-red" /> receding</p>}
      {viz === 1 && <p className="legend"><i className="lg-therm" /> cooler to hotter</p>}
      {viz === 3 && <p className="legend">A lat-long grid painted on the sky reveals how light is bent.</p>}
      <div className="toggles">
        <Toggle label="Spacetime grid" checked={grid} onChange={(v) => engine.setParams({ grid: v })} />
        <Toggle label="Orbit prediction" checked={orbit} onChange={(v) => engine.setParams({ orbitPath: v })} />
        <Toggle label="Pause simulation" checked={paused} onChange={(v) => engine.setParams({ paused: v })} />
      </div>
      <P engine={engine} k="simSpeed" label="Simulation speed" format={(v) => `${v.toFixed(2)}\u00D7`} />
      <P engine={engine} k="doppler" label="Doppler beaming" format={(v) => `${Math.round(v * 100)}%`} tip="Gas moving toward you is brighter and bluer. Interstellar turned this off for clarity." />
      <P engine={engine} k="starDensity" label="Star density" format={(v) => v.toFixed(2)} />
      <P engine={engine} k="exposure" label="Exposure" format={(v) => v.toFixed(2)} />
      <Segmented label="Quality" value={quality} onChange={(v) => engine.setQuality(v)} options={[{ value: 'auto', label: 'Auto' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
      <p className="blurb">{t.quality} {'\u00B7'} {t.res}% internal resolution {'\u00B7'} {Math.round(t.fps)} fps</p>
    </>
  );
}

const CAMS = [
  ['free', 'Free'], ['orbit', 'Orbit'], ['cinematic', 'Cinematic'], ['closeup', 'Close-up'],
  ['earth', 'Earth focus'], ['blackhole', 'Black hole'], ['horizon', 'Event horizon'], ['deep', 'Deep space'],
];

function CameraTab({ engine, t }) {
  return (
    <>
      <div className="cam-grid">
        {CAMS.map(([id, label]) => (
          <button key={id} type="button" className={`chip ${t.cameraMode === id ? 'on' : ''}`} onClick={() => engine.setCameraMode(id)}>{label}</button>
        ))}
      </div>
      <Slider label="Camera distance" value={Math.min(150, Math.max(2, t.camRs || 2))} min={2} max={150} step={0.5} format={(v) => `${v.toFixed(1)} r\u209B`} onChange={(v) => engine.setCameraDistanceRs(v)} />
      <p className="blurb">Drag to orbit {'\u00B7'} pinch or scroll to zoom {'\u00B7'} two fingers or right-drag to pan in Free mode.</p>
    </>
  );
}

function PresetsTab({ engine }) {
  return (
    <>
      <ol className="presets">
        {PRESETS.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => engine.applyPreset(p.id)}>
              <span className="pn">{String(i + 1).padStart(2, '0')}</span>
              <span className="pt">{p.name}</span>
              <span className="pd">{p.note}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="chip ghost wide" onClick={() => engine.resetAll()}>
        <Icon name="reset" size={15} /> Reset laboratory
      </button>
    </>
  );
}

export default function LabPanel({ engine, t }) {
  const open = useStore(uiStore, (s) => s.panel);
  const tab = useStore(uiStore, (s) => s.tab);
  return (
    <aside className={`lab ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Laboratory controls">
      <div className="lab-head">
        <div className="tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => uiStore.set({ tab: x.id })}>{x.label}</button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Close controls" onClick={() => uiStore.set({ panel: false })}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="lab-body">
        {tab === 'bh' && <BlackHoleTab engine={engine} />}
        {tab === 'earth' && <EarthTab engine={engine} t={t} />}
        {tab === 'view' && <ViewTab engine={engine} t={t} />}
        {tab === 'camera' && <CameraTab engine={engine} t={t} />}
        {tab === 'presets' && <PresetsTab engine={engine} />}
      </div>
    </aside>
  );
}
