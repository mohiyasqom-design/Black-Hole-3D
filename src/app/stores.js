import { createStore } from './store.js';
import { defaultParams } from '../data/params.js';

export const paramStore = createStore(defaultParams());

export const uiStore = createStore({
  panel: false,
  tab: 'bh',
  science: false,
  sound: false,
  showcase: false,
  hidden: false,
  telemetryOpen: false,
  card: null,
  introDone: false,
});

let toastId = 0;
export const toastStore = createStore({ items: [] });
export function pushToast(t) {
  const id = ++toastId;
  const items = [...toastStore.get().items, { id, ...t }].slice(-3);
  toastStore.set({ items });
  setTimeout(() => {
    toastStore.set({ items: toastStore.get().items.filter((x) => x.id !== id) });
  }, t.type === 'discovery' ? 5200 : 4200);
}
