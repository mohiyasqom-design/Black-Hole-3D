import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';

export default function InteriorOverlay({ t, engine }) {
  const science = useStore(uiStore, (s) => s.science);
  const deep = t.stage > 0.5;
  const busy = t.sequence === 'deeper' || t.sequence === 'rise' || t.sequence === 'return';
  return (
    <div className="interior">
      <div className="hypo">
        <p className="hypo-badge">Hypothetical Visualization</p>
        <p className="hypo-note">Not a scientifically verified view of a black hole interior.</p>
      </div>
      <div className="interior-foot">
        <p className="interior-stage">{deep ? 'Singularity visualization' : 'Inside the horizon'}</p>
        <p className="interior-hint">{deep ? 'Where General Relativity stops making predictions.' : 'Look around. Behind you, the whole outside universe is squeezed into a shrinking disk.'}</p>
        <div className="actions center">
          {!deep ? (
            <button type="button" className="chip" disabled={busy} onClick={() => engine.goDeeper()}>Go deeper: Singularity</button>
          ) : (
            <button type="button" className="chip ghost" disabled={busy} onClick={() => engine.rise()}>Rise to the interior</button>
          )}
          <button type="button" className="chip primary" disabled={busy} onClick={() => engine.returnToObservation()}>Return to Observation</button>
          {science && (
            <button type="button" className="chip ghost" onClick={() => uiStore.set({ card: 'singularity' })}>What is a singularity?</button>
          )}
        </div>
      </div>
    </div>
  );
}
