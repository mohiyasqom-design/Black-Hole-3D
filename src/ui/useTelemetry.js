import { useEffect, useState } from 'react';

function snapshot(engine) {
  const T = engine.telemetry;
  return { ...T, earth: { ...T.earth }, probe: { ...T.probe } };
}

/** Poll engine telemetry at a low rate so React never renders per frame. */
export function useTelemetry(engine, hz = 6) {
  const [t, setT] = useState(() => snapshot(engine));
  useEffect(() => {
    const id = setInterval(() => setT(snapshot(engine)), 1000 / hz);
    return () => clearInterval(id);
  }, [engine, hz]);
  return t;
}
