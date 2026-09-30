import React, { useEffect, useRef, useState } from 'react';
import { Engine } from '../core/Engine.js';
import { detectWebGL2 } from '../utils/capabilities.js';
import { paramStore, uiStore, pushToast } from './stores.js';
import Interface from '../ui/Interface.jsx';
import Fallback from '../ui/Fallback.jsx';
import IntroTitle from '../ui/IntroTitle.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [support] = useState(() => detectWebGL2());

  useEffect(() => {
    if (!support.ok) return undefined;
    let disposed = false;
    const e = new Engine({
      canvas: canvasRef.current,
      container: wrapRef.current,
      store: paramStore,
      onEvent: (ev) => {
        if (ev.type === 'toast' || ev.type === 'discovery') pushToast(ev);
        else if (ev.type === 'fatal') setFatal(ev.error);
        else if (ev.type === 'tap' && ev.kind === 'space' && ev.count === 1) uiStore.set({ panel: false, card: null });
      },
    });
    e.init()
      .then(() => {
        if (disposed) {
          e.dispose();
          return;
        }
        e.start();
        window.__BHL__ = e; // handy for debugging from the console
        setEngine(e);
      })
      .catch((err) => {
        console.error(err);
        setFatal(err);
      });
    const t = setTimeout(() => uiStore.set({ introDone: true }), 3300);
    return () => {
      disposed = true;
      clearTimeout(t);
      e.dispose();
    };
  }, [support.ok]);

  return (
    <div className="app" ref={wrapRef}>
      <canvas ref={canvasRef} className="gl" aria-label="Black hole visualization. Drag to orbit, pinch to zoom." />
      {!support.ok && <Fallback reason={support.reason} />}
      {fatal && <Fallback reason="The 3D engine hit an unrecoverable error." error={fatal} />}
      {support.ok && !fatal && <IntroTitle />}
      {engine && !fatal && (
        <ErrorBoundary>
          <Interface engine={engine} />
        </ErrorBoundary>
      )}
    </div>
  );
}
