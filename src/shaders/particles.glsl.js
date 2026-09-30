// GPU-animated particle systems. Positions are evaluated analytically in the
// vertex shader, so thousands of particles cost one draw call and no CPU work.

export const JET_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uRs;
uniform float uPower;
uniform float uLength;
uniform float uWidth;
uniform float uSize;
uniform float uPixelRatio;
uniform float uSpin;
varying float vAlpha;
varying float vHeat;
void main() {
  float side = aSeed.w > 0.5 ? 1.0 : -1.0;
  bool core = aSeed.y > 0.75;
  float speed = core ? 0.42 : 0.14 + 0.2 * aSeed.y;
  float s = fract(aSeed.x + uTime * speed * 0.35);
  float y = side * (1.2 + s * uLength);
  float spread = uWidth * (0.06 + s * 0.5) * (0.3 + 0.7 * aSeed.z) * (core ? 0.18 : 1.0);
  float ang = aSeed.z * 6.2831 + s * 6.0 * (1.0 + uSpin) + uTime * 0.6 * side;
  float kink = sin(s * 9.0 - uTime * 1.3 + side) * 0.18 * s * uWidth;
  vec3 pos = vec3(cos(ang) * spread + kink, y, sin(ang) * spread + kink * 0.5) * uRs;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = smoothstep(0.0, 0.05, s) * pow(1.0 - s, 1.7);
  vAlpha = fade * uPower * (core ? 1.3 : 0.35 + 0.65 * aSeed.y);
  vHeat = core ? 1.0 : 1.0 - s;
  float sz = uSize * uPixelRatio * (0.6 + aSeed.y) * (1.0 + s * 1.8) * (30.0 / max(-mv.z, 0.1));
  gl_PointSize = clamp(sz, 0.0, 48.0);
}
`;

export const JET_FRAG = /* glsl */ `
varying float vAlpha;
varying float vHeat;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 18.0) * vAlpha;
  vec3 col = mix(vec3(0.45, 0.55, 1.0), vec3(0.95, 0.93, 1.0), vHeat * vHeat);
  gl_FragColor = vec4(col * a, 0.0);
}
`;

// Matter spiralling inward through the disk: r shrinks over each particle's
// cycle and the orbital angle is the exact integral of the Keplerian rate.
export const DUST_VERT = /* glsl */ `
attribute vec4 aParams;
uniform float uDiskTime;
uniform float uRs;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uThick;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uHotCol;
uniform vec3 uCoolCol;
uniform float uBright;
varying vec3 vCol;
varying float vAlpha;
void main() {
  float r0 = mix(uDiskIn * 1.3, uDiskOut * 1.15, aParams.x);
  float rate = 0.004 * (0.5 + aParams.w);
  float phase = aParams.w * 13.0 + uDiskTime * rate;
  float s = fract(phase);
  float cycle = floor(phase);
  float rin = uDiskIn * 1.02;
  float span = max(r0 - rin, 0.2);
  float r = r0 - span * s;
  float K = 7.0;
  float ang = aParams.y * 6.2831 + cycle * 2.4 + (K / rate) * (2.0 / span) * (inversesqrt(r) - inversesqrt(r0));
  vec3 pos = vec3(cos(ang) * r, aParams.z * r * uThick, sin(ang) * r) * uRs;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float t = clamp((r - uDiskIn) / (uDiskOut - uDiskIn), 0.0, 1.0);
  vCol = mix(uHotCol, uCoolCol, t);
  vAlpha = smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.85, 1.0, s)) * (0.25 + 0.75 * (1.0 - t)) * uBright;
  gl_PointSize = clamp(uSize * uPixelRatio * (0.7 + fract(aParams.w * 91.0)) * (30.0 / max(-mv.z, 0.1)), 0.0, 10.0);
}
`;

export const SOFT_POINT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 22.0) * vAlpha;
  gl_FragColor = vec4(vCol * a, 0.0);
}
`;

export const DEBRIS_VERT = /* glsl */ `
attribute vec2 aData;
uniform float uRs;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vCol;
varying float vAlpha;
void main() {
  vec3 pos = position * uRs;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float alive = step(0.0, aData.x);
  float heat = aData.y;
  vCol = mix(vec3(0.9, 0.28, 0.08), vec3(1.0, 0.9, 0.75), heat);
  vAlpha = alive * (0.35 + 0.9 * heat) * (1.0 - smoothstep(30.0, 40.0, aData.x));
  gl_PointSize = alive * clamp(uSize * uPixelRatio * (0.7 + heat) * (30.0 / max(-mv.z, 0.1)), 0.0, 14.0);
}
`;

export const BEACON_VERT = /* glsl */ `
uniform float uSize;
uniform float uPixelRatio;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * uPixelRatio * (30.0 / max(-mv.z, 0.1)), 3.0, 60.0);
}
`;

export const BEACON_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uRing;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = exp(-d * d * 60.0);
  float ring = exp(-pow((d - 0.38) / 0.04, 2.0)) * uRing;
  gl_FragColor = vec4(uColor * (core + ring) * uAlpha, 0.0);
}
`;
