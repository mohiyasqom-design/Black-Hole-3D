import { useEffect } from 'react';
import { uiStore, paramStore } from '../app/stores.js';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Desktop shortcuts. Deliberately undocumented in the UI, listed in the README. */
export function useKeyboard(engine) {
  useEffect(() => {
    let seq = [];
    let typed = '';
    const onKey = async (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      seq = [...seq, k].slice(-KONAMI.length);
      if (seq.join() === KONAMI.join()) {
        engine.gargantua();
        seq = [];
        return;
      }
      typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-9);
      if (typed === 'gargantua') {
        engine.gargantua();
        typed = '';
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const p = paramStore.get();
      const ui = uiStore.get();
      const interior = engine.world === 'interior';
      switch (k) {
        case '1': case '2': case '3': case '4':
          engine.setParams({ vizMode: Number(k) - 1, eht: false });
          break;
        case 'g': engine.setParams({ grid: !p.grid }); break;
        case 'o': engine.setParams({ orbitPath: !p.orbitPath }); break;
        case ' ':
          e.preventDefault();
          engine.setParams({ paused: !p.paused });
          break;
        case 'e': if (interior) engine.returnToObservation(); else engine.enter(); break;
        case 'q': if (interior) engine.goDeeper(); break;
        case 'c': if (engine.tour) engine.stopTour(); else engine.startTour({ loop: false }); break;
        case 'h': uiStore.set({ hidden: !ui.hidden }); break;
        case 's': uiStore.set({ science: !ui.science, card: null }); break;
        case 'm': {
          const ok = await engine.setSound(!ui.sound);
          uiStore.set({ sound: !ui.sound && ok !== false });
          break;
        }
        case 'p': engine.capturePhoto(); break;
        case 'r': engine.resetAll(); break;
        case 'f': engine.setCameraMode('free'); break;
        case 'b': engine.setCameraMode('blackhole'); break;
        case 'v': engine.setCameraMode('horizon'); break;
        case 't': if (engine.sim.earth && engine.sim.earth.alive) engine.removeEarth(); else engine.addEarth(); break;
        case 'd': engine.dropProbe(); break;
        case 'w': engine.gwPulse(); break;
        case 'x': engine.toggleEHT(); break;
        case 'i': engine.toggleIsolation(); break;
        case 'l': uiStore.set({ panel: !ui.panel }); break;
        case '[': engine.setParams({ simSpeed: p.simSpeed * 0.8 }); break;
        case ']': engine.setParams({ simSpeed: Math.max(0.05, p.simSpeed) * 1.25 }); break;
        case 'Escape':
          if (engine.director.name === 'enter') engine.skip();
          else if (ui.showcase) {
            engine.setShowcase(false);
            uiStore.set({ showcase: false });
          } else uiStore.set({ panel: false, card: null, hidden: false });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);
}
