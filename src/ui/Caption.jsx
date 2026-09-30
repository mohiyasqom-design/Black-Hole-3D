import React from 'react';

export default function Caption({ t }) {
  const c = t.caption;
  if (!c) return null;
  return (
    <div className="caption" key={c.index}>
      <span className="cap-idx">{String(c.index).padStart(2, '0')} / {String(c.total).padStart(2, '0')}</span>
      <p className="cap-title">{c.title}</p>
      <p className="cap-sub">{c.sub}</p>
    </div>
  );
}
