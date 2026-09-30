import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';
import { useTelemetry } from './useTelemetry.js';
import { useKeyboard } from './useKeyboard.js';
import TopBar from './TopBar.jsx';
import Telemetry from './Telemetry.jsx';
import EarthStatus from './EarthStatus.jsx';
import Dock from './Dock.jsx';
import LabPanel from './LabPanel.jsx';
import ScienceLabels from './ScienceLabels.jsx';
import ScienceCard from './ScienceCard.jsx';
import SequenceOverlay from './SequenceOverlay.jsx';
import InteriorOverlay from './InteriorOverlay.jsx';
import Caption from './Caption.jsx';
import Toasts from './Toasts.jsx';
import ShowcaseBar from './ShowcaseBar.jsx';
import { Icon } from './icons.jsx';

export default function Interface({ engine }) {
  const t = useTelemetry(engine);
  const hidden = useStore(uiStore, (s) => s.hidden);
  const showcase = useStore(uiStore, (s) => s.showcase);
  const introDone = useStore(uiStore, (s) => s.introDone);
  const science = useStore(uiStore, (s) => s.science);
  useKeyboard(engine);

  const inEnter = t.sequence === 'enter';
  const interior = t.world === 'interior';
  const chrome = !hidden && !showcase && !inEnter;
  const cls = ['ui', introDone ? 'ready' : '', chrome ? '' : 'chrome-off', interior ? 'is-interior' : ''].join(' ');

  return (
    <div className={cls}>
      <div className="chrome">
        <TopBar engine={engine} t={t} />
        {!interior && <Telemetry t={t} engine={engine} />}
        {!interior && <EarthStatus t={t} engine={engine} />}
        {!interior && <Dock engine={engine} t={t} />}
        {!interior && <LabPanel engine={engine} t={t} />}
      </div>
      {science && chrome && !interior && <ScienceLabels engine={engine} />}
      {!hidden && <ScienceCard />}
      {!hidden && <SequenceOverlay t={t} engine={engine} />}
      {!hidden && !showcase && interior && !inEnter && <InteriorOverlay t={t} engine={engine} />}
      {showcase && interior && <p className="hypo-mini">Hypothetical visualization</p>}
      {!hidden && <Caption t={t} />}
      {!hidden && <Toasts />}
      {showcase && <ShowcaseBar engine={engine} t={t} />}
      {hidden && (
        <button type="button" className="restore" aria-label="Show interface" onClick={() => uiStore.set({ hidden: false })}>
          <Icon name="eye" size={16} />
        </button>
      )}
    </div>
  );
}
