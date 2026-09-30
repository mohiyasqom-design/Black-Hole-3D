// Derived quantities computed once per parameter change (not per frame).
import { BH_TYPES } from '../data/blackholes.js';
import { clamp } from '../utils/math.js';
import { blackbody } from '../utils/color.js';
import {
  kerrHorizon, iscoRadius, photonOrbit, schwarzschildRadius, tidalRadius, diskPeakTemperature, rsLightTime,
} from '../simulation/physics.js';

export function derive(p) {
  const type = BH_TYPES[p.bhType];
  const massRel = p.mass / type.mass.default;
  const rsWorld = type.rsWorld * clamp(Math.pow(massRel, type.massScaleExp), 0.7, 1.6);
  const a = p.spin;
  const horizon = kerrHorizon(a);
  const isco = iscoRadius(a);
  const photon = photonOrbit(a);
  const diskIn = Math.max(isco, horizon * 1.08);
  const diskOut = Math.max(p.diskExtent, diskIn + 3);
  const tidalRadiusReal = tidalRadius(p.mass);
  const tidalRadiusScene = clamp(tidalRadiusReal, 0.5, type.tidalSceneMax);
  const hot = blackbody(p.diskTemp * 1.15);
  const cool = blackbody(p.diskTemp * 0.42);
  const ring = blackbody(p.diskTemp * 1.4).map((c) => c * 0.75 + 0.25);
  const light = blackbody(p.diskTemp);
  return {
    type,
    rsWorld,
    horizon,
    isco,
    photon,
    diskIn,
    diskOut,
    rsMeters: schwarzschildRadius(p.mass),
    rsTime: rsLightTime(p.mass),
    tidalRadiusReal,
    tidalRadiusScene,
    tidalCompressed: tidalRadiusReal > type.tidalSceneMax,
    hotCol: hot.map((c) => c * 1.4),
    coolCol: cool.map((c) => c * 0.9),
    ringCol: ring.map((c) => c * 1.3),
    lightCol: light,
    diskTempReal: diskPeakTemperature(p.mass),
    jetBright: p.jetPower * (0.25 + 0.75 * a * a),
    orbitK: 12,
  };
}
