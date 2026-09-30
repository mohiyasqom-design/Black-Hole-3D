import React from 'react';
import { useStore } from '../app/store.js';
import { toastStore } from '../app/stores.js';

export default function Toasts() {
  const items = useStore(toastStore, (s) => s.items);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={`toast ${x.type === 'discovery' ? 'disc' : ''} ${x.tone || ''}`}>
          {x.type === 'discovery' && <span className="toast-k">Discovery {x.count}/{x.total}</span>}
          <p className="toast-t">{x.title}</p>
          {x.sub && <p className="toast-s">{x.sub}</p>}
        </div>
      ))}
    </div>
  );
}
