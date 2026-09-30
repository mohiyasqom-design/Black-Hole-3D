import * as THREE from 'three';

const N = 420;
/** Predicted orbit of Earth using the same relativistic-precession model as the simulation. */
export class OrbitPath {
  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    m.blending = THREE.CustomBlending;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
    this.line = new THREE.Line(g, m);
    this.line.frustumCulled = false;
    this.opacity = 0;
  }
  update(dt, show, earth, p, d) {
    this.opacity += ((show && earth ? 1 : 0) - this.opacity) * (1 - Math.exp(-4 * dt));
    this.line.visible = this.opacity > 0.01 && !!earth;
    if (!this.line.visible) return;
    const pred = earth.predict(N, d);
    const rs = d.rsWorld;
    const ci = Math.cos(earth.incl), si = Math.sin(earth.incl);
    for (let i = 0; i < N; i++) {
      const [r, phi, unstable] = pred[i];
      const x = r * Math.cos(phi), z = r * Math.sin(phi);
      this.pos[i * 3] = x * rs;
      this.pos[i * 3 + 1] = -z * si * rs;
      this.pos[i * 3 + 2] = z * ci * rs;
      const f = (1 - i / N) * 0.55 * this.opacity;
      this.col[i * 3] = f * (unstable ? 1.0 : 0.95);
      this.col[i * 3 + 1] = f * (unstable ? 0.35 : 0.78);
      this.col[i * 3 + 2] = f * (unstable ? 0.18 : 0.55);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.attributes.color.needsUpdate = true;
  }
}
