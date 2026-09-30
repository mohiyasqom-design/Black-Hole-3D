// Feature detection used before the engine boots, so we can fail gracefully.
export function detectWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { ok: false, reason: 'WebGL 2 is not available in this browser.' };
    const ext = gl.getExtension('WEBGL_lose_context');
    ext && ext.loseContext();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'WebGL failed to initialise.' };
  }
}

export function isMobileDevice() {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return coarse || /Android|iPhone|iPad|Mobile/i.test(ua);
}

export function prefersReducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
