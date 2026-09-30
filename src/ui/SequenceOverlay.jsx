import React from 'react';

export default function SequenceOverlay({ t, engine }) {
  if (t.sequence !== 'enter') return null;
  const inside = t.world === 'interior';
  return (
    <div className="seq">
      {!inside && <p className="seq-kicker">Approaching the event horizon</p>}
      {!inside && (
        <div className="seq-read">
          <span>r = {t.camRs.toFixed(3)} r{'\u209B'}</span>
          <span>your clock {'\u00D7'}{t.camRate.toFixed(3)}</span>
        </div>
      )}
      {!inside && (
        <button type="button" className="chip ghost seq-skip" onClick={() => engine.skip()}>Skip</button>
      )}
    </div>
  );
}
