// Final pass: upsample, motion streaks, chromatic aberration, ACES tonemapping,
// vignette, film grain, flashes and letterboxing. One cheap fullscreen pass.
export const POST_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uTime;
uniform float uExposure;
uniform float uCA;
uniform float uStreak;
uniform float uBlur;
uniform float uVignette;
uniform float uGrain;
uniform float uFlash;
uniform vec3 uFlashCol;
uniform float uFade;
uniform float uLetterbox;
uniform float uGw;
uniform float uGwR;
varying vec2 vUv;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  if (uGw > 0.001) {
    vec2 dd = (uv - uCenter) * vec2(aspect, 1.0);
    float r = length(dd);
    float w = sin((r - uGwR) * 42.0) * exp(-pow((r - uGwR) * 5.0, 2.0)) * uGw;
    uv += (dd / max(r, 1e-4)) * w * 0.006 / vec2(aspect, 1.0);
  }

  vec3 col;
  if (uStreak > 0.001) {
    vec2 dc = uv - uCenter;
    col = vec3(0.0);
    float tot = 0.0;
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      float s = 1.0 - fi * 0.028 * uStreak;
      float w = 1.0 - fi / 10.0;
      col += texture2D(uTex, uCenter + dc * s).rgb * w;
      tot += w;
    }
    col /= tot;
  } else if (uBlur > 0.001) {
    vec2 px = uBlur / uRes;
    col = texture2D(uTex, uv).rgb * 0.2;
    col += texture2D(uTex, uv + vec2(px.x, 0.0)).rgb * 0.1;
    col += texture2D(uTex, uv - vec2(px.x, 0.0)).rgb * 0.1;
    col += texture2D(uTex, uv + vec2(0.0, px.y)).rgb * 0.1;
    col += texture2D(uTex, uv - vec2(0.0, px.y)).rgb * 0.1;
    col += texture2D(uTex, uv + px).rgb * 0.1;
    col += texture2D(uTex, uv - px).rgb * 0.1;
    col += texture2D(uTex, uv + vec2(px.x, -px.y)).rgb * 0.1;
    col += texture2D(uTex, uv + vec2(-px.x, px.y)).rgb * 0.1;
  } else {
    col = texture2D(uTex, uv).rgb;
  }

  if (uCA > 0.001) {
    vec2 off = (uv - 0.5) * uCA * 0.012;
    col.r = mix(col.r, texture2D(uTex, uv + off).r, 0.85);
    col.b = mix(col.b, texture2D(uTex, uv - off).b, 0.85);
  }

  col = aces(col * uExposure);
  vec2 vq = (vUv - 0.5) * vec2(aspect, 1.0);
  float vg = smoothstep(1.15, 0.25, length(vq) * (1.0 + 0.25 / max(aspect, 0.4)));
  col *= mix(1.0, vg, uVignette);
  col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.035 * uGrain;
  col *= 1.0 - uFade;
  if (vUv.y < uLetterbox || vUv.y > 1.0 - uLetterbox) col *= 0.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
