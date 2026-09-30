import React from 'react';
import { useStore } from '../app/store.js';
import { uiStore } from '../app/stores.js';
import { SCIENCE } from '../data/science.js';
import { Icon } from './icons.jsx';

export default function ScienceCard() {
  const key = useStore(uiStore, (s) => s.card);
  const item = key ? SCIENCE[key] : null;
  if (!item) return null;
  return (
    <article className="sci-card" role="dialog" aria-label={item.title}>
      <header>
        <h2>{item.title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => uiStore.set({ card: null })}>
          <Icon name="close" size={15} />
        </button>
      </header>
      <p><b className="tag-sci">Science</b>{item.science}</p>
      <p><b className="tag-lab">In this lab</b>{item.lab}</p>
    </article>
  );
}
