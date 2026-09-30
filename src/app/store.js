import { useSyncExternalStore } from 'react';

/** Minimal external store. The engine reads `get()` every frame without subscribing. */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/** Subscribe a component to one primitive slice of a store. */
export function useStore(store, selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
