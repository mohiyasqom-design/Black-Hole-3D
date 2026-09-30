// Spacetime "rubber sheet" diagram: a funnel below the disk, a dimple for Earth
// and travelling ripples for the gravitational-wave pulse. Illustrative only.
export const GRID_VERT = /* glsl */ `
uniform float uRs;
uniform float uHalf;
uniform float uWell;
uniform vec3 uEarth;
uniform float uEarthMass;
uniform float uGwT;
uniform float uGwAmp;
varying vec3 vW;
varying float vR;
void main() {
  vec2 xz = position.xz * uHalf;
  float r = length(xz) / uRs;
  float y = -uRs * (2.2 + uWell * 5.5 / (r + 0.35));
  vec2 de = xz - uEarth.xz;
  float ed = dot(de, de) / (uRs * uRs);
  y -= uRs * uEarthMass * 0.9 / (1.0 + ed * 1.5);
  if (uGwAmp > 0.0) {
    float x = r - uGwT * 9.0;
    y += uRs * uGwAmp * sin(x * 2.2) * exp(-x * x * 0.03) * exp(-uGwT * 0.25) * 0.8 * smoothstep(0.0, 2.0, r);
  }
  vec4 w = modelMatrix * vec4(xz.x, y, xz.y, 1.0);
  vW = w.xyz;
  vR = r;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const GRID_FRAG = /* glsl */ `
uniform float uRs;
uniform float uHalf;
uniform float uOpacity;
varying vec3 vW;
varying float vR;
void main() {
  vec2 g = vW.xz / (uRs * 1.5);
  vec2 fw = max(fwidth(g), vec2(1e-4));
  vec2 gl = abs(fract(g - 0.5) - 0.5) / fw;
  float ln = 1.0 - min(min(gl.x, gl.y), 1.0);
  float maxR = uHalf / uRs;
  float fade = (1.0 - smoothstep(maxR * 0.55, maxR * 0.98, vR)) * smoothstep(0.8, 2.5, vR);
  float a = ln * fade * uOpacity;
  if (a < 0.015) discard;
  vec3 col = mix(vec3(0.95, 0.72, 0.45), vec3(0.6, 0.7, 0.9), smoothstep(2.0, 18.0, vR)) * 0.22;
  gl_FragColor = vec4(col * a, a);
}
`;
