// INSIDE THE BLACK HOLE (Hypothetical Visualization)
// Not a scientifically verified view. One loosely grounded idea is kept:
// looking back, the outside universe shrinks into a bright, blueshifted disk.
// Everything else is art: a spacetime tunnel, recursive light rings,
// streaking starlight and, deeper, a folding "singularity" phenomenon.
import { NOISE } from './common.glsl.js';

export const INTERIOR_FRAG = /* glsl */ `
// INTERIOR_MAIN
uniform mat4 uCamWorld;
uniform mat4 uInvProj;
uniform float uTime;
uniform float uStage;
uniform float uIntensity;
uniform float uSpin;
uniform vec3 uHotCol;
uniform vec3 uCoolCol;
varying vec2 vUv;

${NOISE}

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }

vec3 tunnel(vec3 d, float t, float comp) {
  float rho = length(d.xy);
  float z = -d.z;
  float ang = atan(d.y, d.x);
  vec3 col = vec3(0.0);
  if (z > 0.0) {
    float zh = z / max(rho, 1e-3) / comp;
    float a = ang + 0.45 * sin(zh * 0.11 + t * 0.23) + uSpin * zh * 0.035;
    float along = zh * 0.55 - t * 2.2;
    float around = a * 1.909859;
    float fog = exp(-zh * 0.045);

    float la = 1.0 - abs(fract(around) - 0.5) * 2.0;
    float lz = 1.0 - abs(fract(along * 0.5) - 0.5) * 2.0;
    float lines = pow(la, 28.0) * 0.9 + pow(lz, 34.0) * 0.6;
    vec3 lc = mix(vec3(1.0, 0.60, 0.30), vec3(0.55, 0.68, 1.0), 0.5 + 0.5 * sin(zh * 0.07 - t * 0.5));
    col += lc * lines * fog * 0.32;

    float mist = fbm3(vec3(cos(a) * 1.6, sin(a) * 1.6, along * 0.18));
    col += mix(uCoolCol, uHotCol, mist) * pow(mist, 5.0) * fog * 0.35;

    float cell = floor(a * 6.366);
    float rnd = h11(cell + 13.0);
    float tp = fract(along * 0.08 * (0.6 + rnd) + rnd * 7.0);
    float cw = 1.0 - abs(fract(a * 6.366) - 0.5) * 2.0;
    float trail = step(0.72, rnd) * pow(cw, 10.0) * smoothstep(0.0, 0.03, tp) * (1.0 - smoothstep(0.03, 0.45, tp));
    col += mix(uHotCol, vec3(1.0), 0.5) * trail * 1.3 * fog;

    float lr = fract(log(zh + 1.0) * 2.2 - t * 0.28);
    col += uHotCol * smoothstep(0.95, 1.0, lr) * 0.28 * fog;

    vec2 sg = vec2(a * 25.46, log(zh + 1.0) * 14.0 - t * 2.5);
    vec2 sid = floor(sg);
    vec2 sf = fract(sg) - 0.5;
    float sh = hash12(sid);
    if (sh > 0.93) col += vec3(0.85, 0.9, 1.0) * exp(-sf.x * sf.x * 90.0) * exp(-sf.y * sf.y * 3.0) * (sh - 0.93) * 14.0 * fog;
  }
  float cz = max(z, 0.0);
  float center = exp(-(rho / max(cz, 1e-3)) * 5.0);
  col *= 1.0 - center * 0.92;
  col += uHotCol * center * 0.06 * (0.5 + 0.5 * sin(t * 1.7));

  // Looking back: the outside universe compressed and blueshifted.
  float back = d.z;
  float cone = smoothstep(0.80, 0.93, back);
  vec3 q = d * 260.0;
  vec3 fq = fract(q) - 0.5;
  float star = step(0.975, hash13(floor(q))) * exp(-dot(fq, fq) * 40.0);
  col += (vec3(0.75, 0.85, 1.0) * star * 2.0 + vec3(0.25, 0.35, 0.6) * 0.12) * cone;
  col += vec3(0.8, 0.9, 1.0) * exp(-pow((back - 0.80) / 0.012, 2.0)) * 0.6;
  return col;
}

vec3 singularity(vec3 d, float t) {
  vec3 col = vec3(0.0);
  float rho = length(d.xy);
  float z = -d.z;
  float ang = atan(d.y, d.x);
  float seg = 6.2831853 / 7.0;
  float ka = abs(mod(ang + t * 0.05, seg) - seg * 0.5);
  float rr = rho / max(z + 1.05, 0.05);
  vec2 kp = vec2(cos(ka), sin(ka)) * rr;

  vec3 p = vec3(kp * 2.2, 0.35 * sin(t * 0.13));
  float acc = 0.0;
  float prev = 0.0;
  for (int i = 0; i < 9; i++) {
    p = abs(p) / (dot(p, p) + 1e-4) - vec3(0.86 + 0.04 * sin(t * 0.21), 0.72, 0.58 + 0.05 * cos(t * 0.17));
    float m = length(p);
    acc += exp(-abs(m - prev) * 6.0);
    prev = m;
  }
  acc /= 9.0;
  vec3 fr = mix(uCoolCol * 0.5, uHotCol, acc) * pow(acc, 3.0) * 1.1;
  col += fr * smoothstep(1.6, 0.0, rr);

  float spokes = pow(abs(sin(ang * 9.0 + log(rr + 1e-3) * 3.0 - t * 1.2)), 40.0);
  col += uHotCol * spokes * exp(-rr * 2.6) * 0.45;
  float cr = fract(log(rr + 1e-3) * 1.6 + t * 0.7);
  col += vec3(1.0, 0.86, 0.7) * smoothstep(0.93, 1.0, cr) * exp(-rr * 1.8) * 0.35;
  col += vec3(1.0, 0.95, 0.9) * exp(-rr * 18.0) * (1.2 + 0.4 * sin(t * 3.0));
  col += uHotCol * exp(-rr * 4.5) * 0.12;
  return col * 0.42 * smoothstep(-0.3, 0.2, z);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp.xyz /= vp.w;
  vec3 d = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
  float s = smoothstep(0.0, 1.0, uStage);
  vec3 a = tunnel(d, uTime, 1.0 + 3.0 * uStage);
  vec3 col = a;
  if (s > 0.001) col = mix(a, singularity(d, uTime) + a * 0.08, s);
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

export const INTERIOR_SAFE_FRAG = /* glsl */ `
// INTERIOR_SAFE
uniform float uTime;
uniform float uStage;
uniform float uIntensity;
uniform vec3 uHotCol;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float rings = pow(0.5 + 0.5 * sin(1.0 / max(r, 0.01) * 2.0 - uTime * 3.0), 12.0);
  float spokes = pow(0.5 + 0.5 * sin(a * 12.0 + uTime), 20.0) * (1.0 - r * 2.0);
  vec3 col = uHotCol * (rings * 0.6 + spokes * 0.4) * smoothstep(0.0, 0.3, r);
  col += vec3(1.0, 0.9, 0.8) * exp(-r * 30.0) * uStage;
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;
