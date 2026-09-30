// Small, allocation-free math helpers shared by simulation and rendering.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential smoothing. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuint = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 5);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Shortest signed angular difference b - a in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const SUP = { '-': '\u207B', 0: '\u2070', 1: '\u00B9', 2: '\u00B2', 3: '\u00B3', 4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079' };
/** Human readable number: plain for moderate values, a×10ⁿ for extremes. */
export function fmt(v, digits = 2) {
  if (v === Infinity) return '\u221E';
  if (!Number.isFinite(v)) return '\u2014';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e5 || a < 1e-2) {
    const e = Math.floor(Math.log10(a));
    const m = v / Math.pow(10, e);
    const exp = String(e).split('').map((c) => SUP[c] ?? c).join('');
    return `${m.toFixed(digits - 1)}\u00D710${exp}`;
  }
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(Math.max(0, digits - 1));
  return v.toFixed(digits);
}

/** Format seconds as mm:ss.t */
export function fmtClock(s) {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}
