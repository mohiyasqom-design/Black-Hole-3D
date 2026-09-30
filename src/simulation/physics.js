// Real physical relations used by the laboratory. Everything that is shown
// as a number in the UI comes from here. Visuals may exaggerate, numbers do not.
//
// Units: the scene works in Schwarzschild radii (rs = 2GM/c^2).
import { clamp } from '../utils/math.js';

export const G = 6.674e-11;
export const C = 2.998e8;
export const M_SUN = 1.989e30;
export const R_EARTH = 6.371e6;
export const M_EARTH = 5.972e24;
export const G_EARTH = 9.81;

/** Schwarzschild radius in meters for a mass given in solar masses. */
export const schwarzschildRadius = (mSolar) => (2 * G * mSolar * M_SUN) / (C * C);

/** Outer Kerr horizon r+ in units of rs (a = dimensionless spin). */
export const kerrHorizon = (a) => 0.5 * (1 + Math.sqrt(1 - clamp(a, 0, 0.9999) ** 2));

/** Prograde innermost stable circular orbit (Bardeen et al. 1972), in rs. */
export function iscoRadius(a) {
  a = clamp(a, 0, 0.9999);
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  const rM = 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2)); // in GM/c^2
  return rM / 2;
}

/** Prograde photon orbit radius in rs (1.5 rs for a = 0). */
export const photonOrbit = (a) => 1 + Math.cos((2 / 3) * Math.acos(-clamp(a, 0, 0.9999)));

/** Rate of a static clock at radius r (rs units) relative to a distant clock. */
export const staticClockRate = (r) => Math.sqrt(Math.max(0, 1 - 1 / r));

/** Rate of a clock on a circular geodesic orbit at radius r (rs units). */
export const circularClockRate = (r) => Math.sqrt(Math.max(0, 1 - 1.5 / r));

/** Locally measured speed of a circular orbit (fraction of c), Schwarzschild. */
export const circularSpeedC = (r) => (r <= 1.5 ? 1 : Math.min(0.9999, Math.sqrt(1 / (2 * (r - 1)))));

/** Tidal stretching acceleration across one Earth radius, m/s^2. */
export function tidalAcceleration(mSolar, rRs) {
  const M = mSolar * M_SUN;
  const r = rRs * schwarzschildRadius(mSolar);
  return (2 * G * M * R_EARTH) / (r * r * r);
}

/** Tidal disruption radius of an Earth-like body, in rs. */
export function tidalRadius(mSolar) {
  const rt = R_EARTH * Math.cbrt((mSolar * M_SUN) / M_EARTH);
  return rt / schwarzschildRadius(mSolar);
}

/** Frequency ratio for light sent radially outward by a probe falling from rest at infinity. */
export const infallRedshift = (r) => Math.max(0, 1 - Math.sqrt(1 / r));

/** Rough peak temperature of a thin, near-Eddington disk (alpha-disk scaling). */
export const diskPeakTemperature = (mSolar) => 1.2e7 * Math.pow(mSolar / 10, -0.25);

/** Light-crossing time of one rs, seconds. */
export const rsLightTime = (mSolar) => schwarzschildRadius(mSolar) / C;
