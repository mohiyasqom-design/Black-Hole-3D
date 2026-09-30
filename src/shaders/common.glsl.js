// Shared GLSL chunks. Written GLSL1-style; three.js compiles them as GLSL ES 3.0.

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s / 0.9375;
}
`;

export const COLOR = /* glsl */ `
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
  } else {
    c.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    c.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  }
  if (t >= 66.0) c.b = 1.0;
  else if (t <= 19.0) c.b = 0.0;
  else c.b = clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
  return pow(c, vec3(2.2));
}
vec3 thermalMap(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.02, 0.01, 0.05);
  vec3 c1 = vec3(0.30, 0.04, 0.38);
  vec3 c2 = vec3(0.86, 0.22, 0.10);
  vec3 c3 = vec3(1.00, 0.78, 0.25);
  vec3 c4 = vec3(1.00, 0.98, 0.90);
  vec3 c = t < 0.25 ? mix(c0, c1, t / 0.25)
         : t < 0.5 ? mix(c1, c2, (t - 0.25) / 0.25)
         : t < 0.75 ? mix(c2, c3, (t - 0.5) / 0.25)
         : mix(c3, c4, (t - 0.75) / 0.25);
  return pow(c, vec3(2.2)) * 1.6;
}
vec3 afmhot(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = clamp(vec3(2.0 * x, 2.0 * x - 0.5, 2.0 * x - 1.0), 0.0, 1.0);
  return pow(c, vec3(2.2)) * 1.4;
}
`;
