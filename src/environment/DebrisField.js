import * as THREE from 'three';
import { DEBRIS_VERT, SOFT_POINT_FRAG } from '../shaders/particles.glsl.js';
import { additiveKeepAlpha } from '../blackhole/Jets.js';

/** Renders the CPU-simulated tidal debris (positions in rs units). */
export class DebrisField {
  constructor(debris) {
    this.debris = debris;
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(debris.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.dataAttr = new THREE.BufferAttribute(debris.data, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aData', this.dataAttr);
    this.uniforms = { uRs: { value: 1 }, uSize: { value: 0.5 }, uPixelRatio: { value: 1 } };
    const m = additiveKeepAlpha(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DEBRIS_VERT, fragmentShader: SOFT_POINT_FRAG }));
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  update(d, pixelRatio) {
    this.uniforms.uRs.value = d.rsWorld;
    this.uniforms.uPixelRatio.value = pixelRatio;
    const active = this.debris.activeCount > 0;
    this.points.visible = active;
    if (active) {
      this.posAttr.needsUpdate = true;
      this.dataAttr.needsUpdate = true;
    }
  }
}
