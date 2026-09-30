// Hybrid Earth: NASA Blue Marble surface texture blended with procedural
// clouds, atmosphere, night-side lights and tidal deformation.
// Lit by the accretion disk: the day side always faces the black hole.
import { NOISE } from './common.glsl.js';

const TIDAL_VERT = /* glsl */ `
uniform vec3 uAxis;
uniform float uStretch;
uniform float uStress;
uniform float uLag;
uniform float uCrack;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
// Volume-preserving stretch along the axis toward the hole, stronger on the near side.
vec3 tidalPos(vec3 w) {
  float along = dot(w, uAxis);
  vec3 perp = w - uAxis * along;
  float s = uStretch * uLag;
  float bias = 1.0 + 0.35 * clamp(s, 0.0, 1.0) * sign(along);
  return uAxis * along * (1.0 + s * bias) + perp / sqrt(1.0 + s);
}
vec3 tidalNormal(vec3 n) {
  float along = dot(n, uAxis);
  vec3 perp = n - uAxis * along;
  float s = uStretch * uLag;
  return normalize(uAxis * along / (1.0 + s) + perp * sqrt(1.0 + s));
}
void main() {
  vLocal = position;
  vec3 center = modelMatrix[3].xyz;
  vec3 w = mat3(modelMatrix) * position;
  vec3 nW = normalize(mat3(modelMatrix) * normal);
  vec3 dw = tidalPos(w);
  float crack = (vnoise(position * 5.0 + 2.0) - 0.5) * 0.08 * smoothstep(0.4, 1.2, uStress) * length(w) * uCrack;
  vNormalW = tidalNormal(nW);
  dw += vNormalW * crack;
  vWorld = center + dw;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

export const EARTH_VERT = TIDAL_VERT;

export const EARTH_FRAG = /* glsl */ `
// EARTH_SURFACE
uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform sampler2D uEarthMap;
uniform float uEarthMapReady;
uniform float uLightI;
uniform float uVisibility;
uniform float uStress;
uniform vec3 uAxis;
uniform float uAppear;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 n = normalize(vLocal);
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightDir);

  float e = fbm3(n * 2.2 + vec3(3.7, 1.1, 5.3));
  e += (vnoise(n * 9.0) - 0.5) * 0.12;
  float land = smoothstep(0.515, 0.535, e);
  float lat = abs(n.y);
  float ice = smoothstep(0.80, 0.88, lat + (e - 0.5) * 0.35);
  float dry = smoothstep(0.35, 0.65, vnoise(n * 3.3 + 8.0)) * (1.0 - smoothstep(0.35, 0.6, lat));
  vec3 landCol = mix(vec3(0.045, 0.085, 0.035), vec3(0.30, 0.24, 0.14), dry);
  landCol = mix(landCol, vec3(0.13, 0.11, 0.09), smoothstep(0.6, 0.72, e));
  vec3 ocean = mix(vec3(0.004, 0.014, 0.045), vec3(0.01, 0.05, 0.10), smoothstep(0.42, 0.515, e));
  vec3 proceduralAlbedo = mix(ocean, landCol, land);
  proceduralAlbedo = mix(proceduralAlbedo, vec3(0.75, 0.8, 0.85), ice);

  // Equirectangular Earth map. Keep a small procedural contribution so the
  // existing tidal/thermal styling remains visible instead of replacing it.
  float lon = atan(n.z, n.x) / 6.28318530718 + 0.5;
  float latMap = asin(clamp(n.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
  vec3 textureAlbedo = texture2D(uEarthMap, vec2(lon, latMap)).rgb;
  vec3 albedo = mix(proceduralAlbedo, textureAlbedo, 0.86 * uEarthMapReady);
  albedo = mix(albedo, vec3(0.75, 0.8, 0.85), ice * 0.35);

  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.22, ndl);
  vec3 col = albedo * (max(ndl, 0.0) * uLightCol * uLightI + 0.012);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - ice) * step(0.0, ndl);
  col += uLightCol * uLightI * spec * 0.9;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.18, 0.35, 0.75) * fr * (0.15 + day * 0.8) * uLightI * 0.6;
  col += uLightCol * albedo * exp(-ndl * ndl * 30.0) * 0.25 * uLightI;

  float city = land * (1.0 - ice) * smoothstep(0.55, 0.85, vnoise(n * 38.0)) * smoothstep(0.45, 0.7, fbm3(n * 7.0 + 2.0));
  col += vec3(1.0, 0.62, 0.28) * city * (1.0 - day) * 0.9;

  float crack = 1.0 - smoothstep(0.0, 0.035, abs(vnoise(n * 5.0 + 2.0) - 0.5));
  float glow = crack * smoothstep(0.35, 1.1, uStress);
  float heat = smoothstep(0.7, 1.6, uStress) * max(dot(N, uAxis), 0.0);
  col += vec3(1.0, 0.38, 0.08) * glow * 2.4 + vec3(1.0, 0.55, 0.25) * heat * 1.5;

  col *= uVisibility;
  float mat = 1.0 - uAppear;
  col = mix(col, vec3(1.0, 0.9, 0.75) * 2.0, mat * mat);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform float uLightI;
uniform float uVisibility;
uniform float uStress;
uniform float uAppear;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 n = normalize(vLocal);
  float warp = fbm3(n * 3.0);
  float c = fbm3(n * vec3(2.6, 5.2, 2.6) + vec3(uTime * 0.02, 0.0, 0.0) + warp * 0.8);
  float cloud = smoothstep(0.50, 0.72, c) * (1.0 - smoothstep(0.6, 1.4, uStress) * 0.8);
  vec3 N = normalize(vNormalW);
  float lit = max(dot(N, normalize(uLightDir)), 0.0);
  vec3 col = vec3(0.92) * (lit * uLightCol * uLightI + 0.01);
  gl_FragColor = vec4(col * uVisibility, cloud * 0.85 * uAppear);
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uLightDir;
uniform float uLightI;
uniform float uVisibility;
uniform float uStress;
uniform float uAppear;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(N, V)), 2.2);
  float day = smoothstep(-0.35, 0.4, dot(N, normalize(uLightDir)));
  vec3 col = mix(vec3(0.9, 0.45, 0.2), vec3(0.25, 0.5, 1.0), day) * rim * (0.08 + day) * uLightI * 0.9;
  col += vec3(1.0, 0.4, 0.1) * rim * smoothstep(0.4, 1.4, uStress) * 0.8;
  gl_FragColor = vec4(col * uVisibility * uAppear, 0.0);
}
`;
