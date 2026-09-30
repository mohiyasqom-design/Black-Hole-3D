import React, { useEffect, useRef } from 'react';

/**
 * Shown when WebGL 2 is unavailable or the engine fails. A Canvas 2D drawing
 * keeps the identity of the experience instead of a blank page.
 */
export default function Fallback({ reason, error }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    let raf;
    const draw = (now) => {
      const w = (c.width = c.clientWidth * Math.min(2, window.devicePixelRatio || 1));
      const h = (c.height = c.clientHeight * Math.min(2, window.devicePixelRatio || 1));
      const t = now / 1000;
      ctx.fillStyle = '#060504';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.12;
      for (let i = 0; i < 160; i++) {
        const a = (i * 137.5 * Math.PI) / 180;
        const r = ((i * 7919) % 1000) / 1000;
        const x = (((i * 104729) % 997) / 997) * w, y = (((i * 1299709) % 991) / 991) * h;
        ctx.fillStyle = `rgba(230,220,205,${0.15 + 0.5 * r})`;
        ctx.fillRect(x + Math.sin(a + t * 0.05) * 0.5, y, 1.2, 1.2);
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.24);
      const g = ctx.createRadialGradient(0, 0, R * 1.3, 0, 0, R * 4);
      g.addColorStop(0, 'rgba(255,214,150,0.95)');
      g.addColorStop(0.4, 'rgba(240,140,60,0.55)');
      g.addColorStop(1, 'rgba(120,40,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,225,180,0.9)';
      ctx.lineWidth = Math.max(1.5, R * 0.05);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#060504';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="fallback">
      <canvas ref={ref} />
      <div className="fallback-text">
        <h1>
          <span className="b1">Black Hole</span>
          <span className="b2">Laboratory</span>
        </h1>
        <p>{reason}</p>
        <p className="fallback-small">Try a recent Chrome, Firefox or Edge, enable hardware acceleration, and reload.{error ? ` (${String(error.message || error).slice(0, 120)})` : ''}</p>
        <button type="button" className="chip" onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  );
}
