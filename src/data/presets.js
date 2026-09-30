// Presets are dramatic, complete looks. `camera` names a CameraRig mode.
import { typeDefaults } from './params.js';

export const PRESETS = [
  {
    id: 'stable', name: 'Stable Orbit', note: 'Calm circular orbit, spacetime grid on.',
    params: { ...typeDefaults('supermassive'), spin: 0.7, earthDistance: 16, earthVelocity: 1, tidalGain: 1, simSpeed: 1, grid: true, orbitPath: true, lensing: 1 },
    earth: true, camera: 'blackhole',
  },
  {
    id: 'extreme', name: 'Extreme Gravity', note: 'Maximum lensing, near-extremal spin, grazing view.',
    params: { ...typeDefaults('supermassive'), spin: 0.998, lensing: 1.5, photonRing: 1.7, diskDensity: 1.2, exposure: 1.1 },
    camera: 'horizon',
  },
  {
    id: 'tidal', name: 'Tidal Destruction', note: 'Stellar hole, Earth at the edge of its tidal radius. Nudge it closer.',
    params: { ...typeDefaults('stellar'), earthDistance: 9.6, earthVelocity: 1, tidalGain: 1.1, simSpeed: 1 },
    earth: true, camera: 'earth',
  },
  {
    id: 'massive', name: 'Massive Black Hole', note: 'M87*-scale. Earth crosses the horizon intact.',
    params: { ...typeDefaults('supermassive'), mass: 6.5e9, diskExtent: 20, diskTemp: 4300, jetPower: 0.9, earthDistance: 5, earthVelocity: 0.8 },
    earth: true, camera: 'blackhole',
  },
  {
    id: 'spin', name: 'Fast Spin', note: 'a* = 0.998, fast disk, powerful jets.',
    params: { spin: 0.998, diskSpeed: 2.6, jetPower: 1.8, doppler: 1, photonRing: 1.3 },
    camera: 'orbit',
  },
  {
    id: 'maxdisk', name: 'Maximum Disk', note: 'Dense, hot and enormous accretion flow.',
    params: { diskDensity: 2, diskExtent: 22, diskTemp: 9000, diskSpeed: 1.5, exposure: 0.9 },
    camera: 'closeup',
  },
  {
    id: 'deep', name: 'Deep Space', note: 'Pull back and let the lens bend the sky.',
    params: { starDensity: 2.2, jetPower: 0.8, lensing: 1.2 },
    camera: 'deep',
  },
  {
    id: 'cinematic', name: 'Cinematic', note: 'Warm, thin disk, slow drift. Made for recording.',
    params: { ...typeDefaults('supermassive'), mass: 1e8, spin: 0.95, diskTemp: 5000, diskExtent: 16, diskDensity: 1.1, doppler: 0.7, jetPower: 0.35, exposure: 1.05 },
    camera: 'orbit',
  },
];

// Unlocked by the Konami code on desktop, or a long-press on the title on touch.
export const SECRET_GARGANTUA = {
  id: 'gargantua', name: 'Gargantua',
  note: 'Interstellar dropped Doppler beaming so audiences could read the disk. So do we.',
  params: { ...typeDefaults('supermassive'), mass: 1e8, spin: 0.998, diskTemp: 4700, diskExtent: 14, diskDensity: 1.25, doppler: 0, jetPower: 0, lensing: 1.1, photonRing: 1.2, exposure: 1.1 },
  camera: 'horizon',
};
