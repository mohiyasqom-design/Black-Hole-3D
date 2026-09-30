// Approximate black-body color (Tanner Helland fit) returned in *linear* RGB.
// Mirrors the GLSL version in shaders/noise.glsl.js so CPU and GPU agree.
import { clamp } from './math.js';

export function blackbody(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 1;
    g = clamp(0.39008157876 * Math.log(t) - 0.63184144378, 0, 1);
  } else {
    r = clamp(1.29293618606 * Math.pow(t - 60, -0.1332047592), 0, 1);
    g = clamp(1.12989086089 * Math.pow(t - 60, -0.0755148492), 0, 1);
  }
  if (t >= 66) b = 1;
  else if (t <= 19) b = 0;
  else b = clamp(0.54320678911 * Math.log(t - 10) - 1.19625408914, 0, 1);
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
}
