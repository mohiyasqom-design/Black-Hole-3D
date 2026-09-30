import * as THREE from 'three';
import { GRID_VERT, GRID_FRAG } from '../shaders/grid.glsl.js';

export class SpacetimeGrid {
  constructor() {
    const g = new THREE.PlaneGeometry(2, 2, 180, 180);
    g.rotateX(-Math.PI / 2);
    this.uniforms = {
      uRs: { value: 1 },
      uHalf: { value: 60 },
      uWell: { value: 1 },
      uEarth: { value: new THREE.Vector3(1e5, 0, 1e5) },
      uEarthMass: { value: 0 },
      uGwT: { value: 0 },
      uGwAmp: { value: 0 },
      uOpacity: { value: 0 },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      side: THREE.DoubleSide,
      blending: THREE.NoBlending,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.opacity = 0;
  }
  update(dt, show, d, p, earthWorld, earthMass, gw) {
    this.opacity += ((show ? 1 : 0) - this.opacity) * (1 - Math.exp(-3 * dt));
    const u = this.uniforms;
    u.uOpacity.value = this.opacity;
    u.uRs.value = d.rsWorld;
    u.uHalf.value = d.rsWorld * Math.max(40, d.diskOut * 3.2);
    u.uWell.value = 0.6 + 0.4 * p.lensing;
    if (earthWorld) u.uEarth.value.copy(earthWorld);
    u.uEarthMass.value = earthMass;
    u.uGwT.value = gw.t;
    u.uGwAmp.value = gw.amp;
    this.mesh.visible = this.opacity > 0.01;
  }
}
