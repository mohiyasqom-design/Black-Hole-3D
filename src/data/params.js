import { BH_TYPES } from './blackholes.js';
import { clamp } from '../utils/math.js';

// Hard ranges. Every write goes through sanitize() so no value can break the scene.
export const RANGES = {
  spin: [0, 0.998],
  diskSpeed: [0, 3],
  diskTemp: [2500, 30000],
  diskDensity: [0.1, 2],
  diskExtent: [5, 22],
  jetPower: [0, 2],
  lensing: [0, 1.5],
  photonRing: [0, 2],
  starDensity: [0.2, 2.5],
  doppler: [0, 1],
  exposure: [0.4, 2.2],
  simSpeed: [0, 4],
  earthDistance: [1.6, 40],
  earthVelocity: [0.55, 1.35],
  earthInclination: [-70, 70],
  tidalGain: [0, 3],
};

export function typeDefaults(type) {
  const T = BH_TYPES[type];
  return {
    bhType: type,
    mass: T.mass.default,
    spin: T.spin,
    diskTemp: T.diskTemp,
    diskExtent: T.diskExtent,
    jetPower: T.jetPower,
    earthDistance: T.earthDistance,
  };
}

export function defaultParams() {
  return {
    ...typeDefaults('supermassive'),
    diskSpeed: 1,
    diskDensity: 1,
    lensing: 1,
    photonRing: 1,
    starDensity: 1,
    doppler: 0.85,
    exposure: 1,
    simSpeed: 1,
    paused: false,
    earthVelocity: 1,
    earthInclination: 8,
    earthDirection: 1,
    tidalGain: 1,
    vizMode: 0,
    grid: false,
    orbitPath: true,
    quality: 'auto',
    isolate: false,
    eht: false,
  };
}

export function sanitize(patch, current) {
  const out = { ...patch };
  for (const k of Object.keys(out)) {
    if (RANGES[k] && typeof out[k] === 'number') {
      const v = Number.isFinite(out[k]) ? out[k] : current[k];
      out[k] = clamp(v, RANGES[k][0], RANGES[k][1]);
    }
  }
  if (out.mass !== undefined) {
    const type = out.bhType ?? current.bhType;
    const m = BH_TYPES[type].mass;
    out.mass = clamp(Number.isFinite(out.mass) ? out.mass : m.default, m.min, m.max);
  }
  if (out.earthDirection !== undefined) out.earthDirection = out.earthDirection >= 0 ? 1 : -1;
  return out;
}
