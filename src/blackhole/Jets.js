import * as THREE from 'three';
import { JET_VERT, JET_FRAG } from '../shaders/particles.glsl.js';
import { MAX_PARTICLES } from '../data/quality.js';

/** Additive blending that leaves the render-target alpha untouched (alpha = scene coverage). */
export function additiveKeepAlpha(material) {
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneFactor;
  material.blendSrcAlpha = THREE.ZeroFactor;
  material.blendDstAlpha = THREE.OneFactor;
  return material;
}

/** Bipolar relativistic jets: two particle populations (sheath + fast core). */
export class Jets {
  constructor() {
    const n = MAX_PARTICLES.jets;
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = i % 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.uniforms = {
      uTime: { value: 0 },
      uRs: { value: 1 },
      uPower: { value: 1 },
      uLength: { value: 30 },
      uWidth: { value: 1 },
      uSize: { value: 0.9 },
      uPixelRatio: { value: 1 },
      uSpin: { value: 0.5 },
    };
    const m = additiveKeepAlpha(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: JET_VERT, fragmentShader: JET_FRAG }));
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }
  setCount(n) {
    this.points.geometry.setDrawRange(0, n);
  }
  update(time, p, d, pixelRatio) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uRs.value = d.rsWorld;
    u.uPower.value = d.jetBright;
    u.uLength.value = d.type.jetLength;
    u.uWidth.value = d.type.jetWidth;
    u.uSpin.value = p.spin;
    u.uPixelRatio.value = pixelRatio;
    this.points.visible = d.jetBright > 0.005 && !p.eht;
  }
}
