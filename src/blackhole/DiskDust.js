import * as THREE from 'three';
import { DUST_VERT, SOFT_POINT_FRAG } from '../shaders/particles.glsl.js';
import { MAX_PARTICLES } from '../data/quality.js';
import { additiveKeepAlpha } from './Jets.js';

/** Sparse luminous clumps spiralling inward through the disk; they add parallax and are lensed. */
export class DiskDust {
  constructor() {
    const n = MAX_PARTICLES.dust;
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      a[i * 4] = Math.pow(u, 1.6);
      a[i * 4 + 1] = Math.random();
      // approx gaussian vertical offset
      a[i * 4 + 2] = (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;
      a[i * 4 + 3] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aParams', new THREE.BufferAttribute(a, 4));
    this.uniforms = {
      uDiskTime: { value: 0 },
      uRs: { value: 1 },
      uDiskIn: { value: 3 },
      uDiskOut: { value: 12 },
      uThick: { value: 0.06 },
      uSize: { value: 0.35 },
      uPixelRatio: { value: 1 },
      uHotCol: { value: new THREE.Vector3() },
      uCoolCol: { value: new THREE.Vector3() },
      uBright: { value: 1 },
    };
    const m = additiveKeepAlpha(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DUST_VERT, fragmentShader: SOFT_POINT_FRAG }));
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
  }
  setCount(n) {
    this.points.geometry.setDrawRange(0, n);
  }
  update(diskTime, p, d, pixelRatio, intro) {
    const u = this.uniforms;
    u.uDiskTime.value = diskTime;
    u.uRs.value = d.rsWorld;
    u.uDiskIn.value = d.diskIn;
    u.uDiskOut.value = d.diskOut;
    u.uThick.value = d.type.diskThickness;
    u.uPixelRatio.value = pixelRatio;
    u.uHotCol.value.set(d.hotCol[0], d.hotCol[1], d.hotCol[2]);
    u.uCoolCol.value.set(d.coolCol[0], d.coolCol[1], d.coolCol[2]);
    u.uBright.value = 0.9 * p.diskDensity * intro * (p.eht || p.vizMode === 3 ? 0.2 : 1);
  }
}
