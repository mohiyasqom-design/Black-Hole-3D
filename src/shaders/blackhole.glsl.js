// BLACK HOLE COMPOSITOR
// For every pixel a light ray is traced backwards from the camera through an
// approximate Schwarzschild deflection field (a = -1.5 h^2 r / |r|^5, rs = 1)
// plus a small physically inspired frame-dragging twist for spin. Along the
// way it collects accretion-disk emission (with Doppler + gravitational shift)
// and volumetric haze. Escaped rays sample a procedural sky and the rasterized
// scene (Earth, jets, debris, grid) in their *bent* direction, so everything
// in the scene is lensed. Rays that reach the horizon stay black.
//
// Physically Inspired Visualization, not a general-relativistic solver.
import { NOISE, COLOR } from './common.glsl.js';

export const BLACKHOLE_FRAG = /* glsl */ `
// BH_MAIN
uniform sampler2D uScene;
uniform sampler2D uSceneDepth;
uniform vec3 uCamPos;
uniform mat4 uCamWorld;
uniform mat4 uInvProj;
uniform mat4 uViewProj;
uniform mat4 uInvViewProj;
uniform float uRs;
uniform float uSpin;
uniform float uLens;
uniform float uHorizon;
uniform float uPhotonR;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uDiskTemp;
uniform float uDiskDensity;
uniform float uDiskThick;
uniform float uDiskBright;
uniform float uDiskTime;
uniform float uDoppler;
uniform float uRing;
uniform vec3 uRingCol;
uniform vec3 uHotCol;
uniform vec3 uCoolCol;
uniform float uStarDensity;
uniform float uStarBright;
uniform float uTime;
uniform float uMode;
uniform float uEnter;
uniform float uIsolate;
varying vec2 vUv;

${NOISE}
${COLOR}

vec2 rot2(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

float diskProfile(float rr) {
  float inner = smoothstep(uDiskIn * 0.9, uDiskIn * 1.35, rr);
  float outer = 1.0 - smoothstep(uDiskOut * 0.45, uDiskOut, rr);
  return inner * outer;
}

// Shakura-Sunyaev thin disk: T ~ r^-3/4 (1 - sqrt(r_in/r))^1/4, normalized to peak = uDiskTemp.
float diskTempAt(float rr) {
  float x = clamp(uDiskIn / rr, 0.0, 1.0);
  return uDiskTemp * 1.95 * pow(x, 0.75) * pow(max(1.0 - 0.97 * sqrt(x), 0.02), 0.25);
}

float clumps(vec2 q, float rr, float seed) {
  vec3 np = vec3(q * 0.55, rr * 0.15 + seed);
  float n1 = fbm3(np);
  float n2 = vnoise(vec3(q * 2.4, seed * 1.7 + 3.1));
  float fil = 1.0 - abs(2.0 * vnoise(vec3(q * 1.25, seed + 7.3)) - 1.0);
  fil *= fil;
  float bands = 0.72 + 0.28 * sin(rr * 5.0 + n1 * 5.0);
  return (0.18 + 2.0 * n1 * n1) * (0.62 + 0.55 * n2) * (0.55 + 0.7 * fil) * bands;
}

vec4 diskSample(vec3 hp, float rr, vec3 vdir, float order) {
  float prof = diskProfile(rr);
  float plunge = (1.0 - smoothstep(uDiskIn * 0.85, uDiskIn * 1.05, rr)) * smoothstep(uHorizon * 1.02, uDiskIn, rr);
  if (prof + plunge < 0.002) return vec4(0.0);

  // Differential (Keplerian) rotation with a two-phase flow map so the
  // pattern shears into spirals without winding up forever.
  float omega = 1.0 / (rr * sqrt(rr));
  float cyc = uDiskTime / 6.0;
  float f1 = fract(cyc);
  float f2 = fract(cyc + 0.5);
  float w1 = 1.0 - abs(2.0 * f1 - 1.0);
  float s1 = floor(cyc) * 3.7;
  float s2 = floor(cyc + 0.5) * 3.7 + 11.0;
  vec2 q1 = rot2(hp.xz, -omega * f1 * 42.0);
  vec2 q2 = rot2(hp.xz, -omega * f2 * 42.0);
  float dens = mix(clumps(q2, rr, s2), clumps(q1, rr, s1), w1);
  float spiral = 0.5 + 0.5 * sin(atan(q1.y, q1.x) * 3.0 + log(rr) * 9.0);
  float density = prof * dens + plunge * 0.35 * spiral * dens;

  // Relativistic Doppler factor and gravitational redshift of the orbiting gas.
  vec3 u = normalize(vec3(-hp.z, 0.0, hp.x));
  float beta = clamp(sqrt(0.5 / max(rr - 1.0, 0.35)), 0.0, 0.7);
  float cosT = dot(u, -vdir);
  float gam = inversesqrt(1.0 - beta * beta);
  float D = 1.0 / (gam * (1.0 - beta * cosT));
  float grav = sqrt(max(1.0 - 1.5 / rr, 0.04));
  float g = mix(1.0, D * grav, uDoppler);
  float Tloc = diskTempAt(max(rr, uDiskIn));
  float T = Tloc * g;
  float I = pow(g, 2.4);
  float heat = Tloc / uDiskTemp;

  vec3 c;
  if (uMode < 0.5) {
    c = blackbody(T) * (0.3 + 1.1 * heat * heat);
  } else if (uMode < 1.5) {
    c = thermalMap(T / (uDiskTemp * 1.7));
    I = 1.0;
  } else if (uMode < 2.5) {
    float sh = clamp((g - 1.0) * 2.2, -1.0, 1.0);
    vec3 tint = sh > 0.0 ? vec3(0.25, 0.45, 1.0) : vec3(1.0, 0.28, 0.12);
    c = mix(vec3(0.55), tint, abs(sh));
    I = 0.6 + 0.4 * g;
  } else if (uMode < 3.5) {
    c = blackbody(T) * 0.3;
  } else {
    c = vec3(0.35 + 1.4 * heat * heat);
  }

  float weight = order < 0.5 ? mix(1.0, 0.05, uIsolate) : mix(1.0, 2.4, uIsolate);
  float alpha = clamp(density * 0.5 * uDiskDensity, 0.0, 0.93) * weight;
  vec3 emit = c * density * I * uDiskBright * uDiskDensity * weight * (1.0 + 0.8 * uEnter);
  return vec4(emit, clamp(alpha, 0.0, 0.95));
}

vec3 starfield(vec3 d) {
  vec3 col = vec3(0.0);
  vec3 N = normalize(vec3(0.85, 0.42, 0.32));
  float bv = dot(d, N);
  float band = exp(-bv * bv * 12.0);
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float sc = 180.0 + fl * 260.0;
    vec3 q = d * sc;
    vec3 id = floor(q);
    vec3 f = fract(q) - 0.5;
    float h = hash13(id + fl * 31.7);
    float thr = 1.0 - (0.04 + 0.05 * fl + band * 0.05) * uStarDensity;
    if (h > thr) {
      vec3 off = (hash33(id + 4.1) - 0.5) * 0.55;
      vec3 dv = f - off;
      float dd = dot(dv, dv);
      float b = (h - thr) / (1.0 - thr);
      float sz = 0.010 + 0.022 * b;
      float core = exp(-dd / sz);
      float halo = exp(-dd / (sz * 9.0)) * 0.08 * step(0.85, b) * (1.0 - fl);
      float tw = 0.8 + 0.2 * sin(uTime * (1.5 + 3.0 * h) + h * 90.0);
      vec3 tint = mix(vec3(1.0, 0.74, 0.52), vec3(0.72, 0.82, 1.0), hash13(id + 9.0));
      col += tint * (core + halo) * (0.25 + 2.2 * b * b) * tw;
    }
  }
#if STAR_QUALITY > 0
  float n = fbm3(d * 2.6 + 1.3);
  float n2 = vnoise(d * 11.0);
  vec3 neb = mix(vec3(0.050, 0.034, 0.024), vec3(0.020, 0.028, 0.045), n) * band * (0.35 + 1.4 * n * n2);
  neb *= 1.0 - 0.75 * smoothstep(0.42, 0.62, n2) * band;
  col += neb * 0.6;
#endif
  return col * uStarBright;
}

vec3 lensingMap(vec3 d) {
  float lon = atan(d.z, d.x) / 3.14159265;
  float lat = asin(clamp(d.y, -1.0, 1.0)) / 1.5707963;
  vec2 g = vec2(lon * 9.0, lat * 4.5);
  vec2 fg = abs(fract(g) - 0.5);
  float ln = smoothstep(0.43, 0.5, max(fg.x, fg.y));
  float chk = mod(floor(g.x) + floor(g.y), 2.0);
  vec3 base = mix(vec3(0.030, 0.026, 0.022), vec3(0.075, 0.064, 0.050), chk);
  float pole = smoothstep(0.9, 1.0, abs(lat));
  return base + ln * vec3(0.85, 0.62, 0.34) * 0.55 + pole * vec3(0.2, 0.3, 0.5) * 0.2;
}

vec3 sky(vec3 d) {
  if (uMode > 3.5) return vec3(0.0);
  if (uMode > 2.5) return lensingMap(d);
  return starfield(d);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp.xyz /= vp.w;
  vec3 dir = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);

  vec4 direct = texture2D(uScene, vUv);
  float dep = texture2D(uSceneDepth, vUv).r;
  float sceneDist = 1e9;
  if (dep < 0.99999) {
    vec4 wp = uInvViewProj * vec4(ndc, dep * 2.0 - 1.0, 1.0);
    wp.xyz /= wp.w;
    sceneDist = length(wp.xyz - uCamPos);
  }

  vec3 p = uCamPos / uRs;
  vec3 v = dir;
  float bound = max(uDiskOut * 1.25, 12.0);
  vec3 col = vec3(0.0);
  vec3 haze = vec3(0.0);
  float A = 0.0;
  bool captured = false;
  bool hitScene = false;
  bool march = true;
  float travelled = 0.0;
  float minR = 1e9;
  float crossings = 0.0;

  // Rays that start outside the region of interest travel straight to it.
  if (dot(p, p) > bound * bound) {
    float b = dot(p, v);
    float c = dot(p, p) - bound * bound;
    float disc = b * b - c;
    if (disc < 0.0 || b > 0.0) {
      march = false;
    } else {
      float tEnter = -b - sqrt(disc);
      p += v * tEnter;
      travelled = tEnter * uRs;
    }
  }
  if (sceneDist < travelled) {
    hitScene = true;
    march = false;
  }

  vec3 hv = cross(p, v);
  float h2 = dot(hv, hv);
  vec3 spinAxis = vec3(0.0, 1.0, 0.0);

  if (march) {
    for (int i = 0; i < MAX_STEPS; i++) {
      float r = length(p);
      minR = min(minR, r);
      if (r < uHorizon) { captured = true; break; }
      if (r > bound && dot(p, v) > 0.0) break;

      float dt = clamp(STEP_K * r * min(r, 6.0) * 0.35, 0.012, 1.6);
      float r2 = r * r;
      vec3 acc = -1.5 * h2 * p / (r2 * r2 * r) * uLens;
      acc += uSpin * 0.6 * cross(spinAxis, v) / (r2 * r) * uLens;
      v += acc * dt;
      vec3 pn = p + v * dt;
      travelled += length(v) * dt * uRs;

      if (!hitScene && travelled > sceneDist) {
        if (dot(normalize(v), dir) > 0.9995) { hitScene = true; break; }
        sceneDist = 1e9;
      }

      if (p.y * pn.y < 0.0 && crossings < 4.0) {
        float tc = p.y / (p.y - pn.y);
        vec3 hp = mix(p, pn, tc);
        float rr = length(hp.xz);
        if (rr > uHorizon && rr < uDiskOut) {
          vec4 ds = diskSample(hp, rr, normalize(v), crossings);
          col += (1.0 - A) * ds.rgb;
          A += (1.0 - A) * ds.a;
          crossings += 1.0;
        }
      }

      float rh = length(pn.xz);
      if (rh > uDiskIn * 0.8 && rh < uDiskOut) {
        float th = uDiskThick * rh + 0.05;
        float w = exp(-pn.y * pn.y / (th * th)) * diskProfile(rh) * dt;
        haze += (1.0 - A) * mix(uHotCol, uCoolCol, clamp((rh - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0)) * w;
      }

      p = pn;
      if (A > 0.985) break;
    }
  }

  vec3 bg = vec3(0.0);
  if (hitScene) {
    bg = direct.rgb;
    if (direct.a < 0.99) bg += (1.0 - direct.a) * sky(dir);
  } else if (!captured) {
    vec3 d = normalize(v);
    bg = sky(d);
    vec4 cp = uViewProj * vec4(uCamPos + d * 2000.0, 1.0);
    if (cp.w > 0.0) {
      vec2 suv = cp.xy / cp.w * 0.5 + 0.5;
      if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
        // The scene is sampled as if at infinity; fade it for strongly bent rays so
        // nearby objects (jets) do not form an oversized Einstein ring.
        float bend = acos(clamp(dot(d, dir), -1.0, 1.0));
        vec4 s = texture2D(uScene, suv) * exp(-bend * 9.0);
        bg = bg * (1.0 - s.a) + s.rgb;
      }
    }
    float ringW = 0.03 + 0.02 * (1.0 - clamp(uLens, 0.0, 1.0));
    float ring = exp(-pow((minR - uPhotonR) / ringW, 2.0));
    col += (1.0 - A) * uRingCol * ring * uRing * (0.9 + 1.6 * uIsolate);
  } else {
    // Captured: keep a little of the additive foreground (jets in front of the shadow).
    col += (1.0 - A) * direct.rgb * (1.0 - direct.a) * 0.55;
  }

  bg *= 1.0 - 0.75 * uEnter;
  col += haze * uDiskDensity * 0.035 * uDiskBright;
  col += (1.0 - A) * bg;

  if (uMode > 3.5) {
    float lum = dot(col, vec3(0.3, 0.55, 0.15));
    col = afmhot(lum * 0.55);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// Fallback used if the main shader fails to compile on a device. It keeps the
// identity of the scene (shadow, ring, disk band, stars) with straight rays.
export const BLACKHOLE_SAFE_FRAG = /* glsl */ `
// BH_SAFE
uniform sampler2D uScene;
uniform vec3 uCamPos;
uniform mat4 uCamWorld;
uniform mat4 uInvProj;
uniform float uRs;
uniform float uDiskIn;
uniform float uDiskOut;
uniform vec3 uHotCol;
uniform vec3 uCoolCol;
uniform vec3 uRingCol;
uniform float uDiskBright;
uniform float uTime;
varying vec2 vUv;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp.xyz /= vp.w;
  vec3 d = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
  vec3 p = uCamPos / uRs;
  float tca = -dot(p, d);
  float b = length(p + d * max(tca, 0.0));
  vec3 col = vec3(0.0);
  vec3 q = d * 200.0;
  float h = h13(floor(q));
  col += step(0.965, h) * exp(-dot(fract(q) - 0.5, fract(q) - 0.5) * 60.0) * vec3(0.9, 0.9, 1.0);
  vec4 s = texture2D(uScene, vUv);
  col = col * (1.0 - s.a) + s.rgb;
  if (abs(d.y) > 1e-4) {
    float t = -p.y / d.y;
    if (t > 0.0) {
      vec3 hp = p + d * t;
      float rr = length(hp.xz);
      float band = smoothstep(uDiskIn, uDiskIn * 1.3, rr) * (1.0 - smoothstep(uDiskOut * 0.5, uDiskOut, rr));
      float stripes = 0.7 + 0.3 * sin(rr * 6.0 - uTime * 2.0 + atan(hp.z, hp.x) * 2.0);
      if (!(tca > 0.0 && b < 2.6 && t > tca)) col += mix(uHotCol, uCoolCol, (rr - uDiskIn) / (uDiskOut - uDiskIn)) * band * stripes * uDiskBright;
    }
  }
  if (tca > 0.0 && b < 2.6) col *= 0.0;
  col += uRingCol * exp(-pow((b - 2.6) / 0.07, 2.0)) * step(0.0, tca) * 1.4;
  gl_FragColor = vec4(col, 1.0);
}
`;
