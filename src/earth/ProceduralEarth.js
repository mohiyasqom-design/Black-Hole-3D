import * as THREE from 'three';
import { EARTH_VERT, EARTH_FRAG, CLOUD_FRAG, ATMO_FRAG } from '../shaders/earth.glsl.js';
import { additiveKeepAlpha } from '../blackhole/Jets.js';

/**
 * Earth made from three shader layers on shared tidal-deformation uniforms.
 * Interface shared with GLBEarth: object, update(state), setVisible(), dispose().
 */
export class ProceduralEarth {
  constructor(segments = [96, 64]) {
    this.kind = 'procedural';
    this.object = new THREE.Group();
    this.shared = {
      uAxis: { value: new THREE.Vector3(1, 0, 0) },
      uStretch: { value: 0 },
      uStress: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uLightCol: { value: new THREE.Color(1, 0.8, 0.6) },
      uLightI: { value: 1 },
      uVisibility: { value: 1 },
      uAppear: { value: 1 },
      uTime: { value: 0 },
    };
    const mk = (frag, lag, crack, extra = {}) =>
      new THREE.ShaderMaterial({
        uniforms: { ...this.shared, uLag: { value: lag }, uCrack: { value: crack } },
        vertexShader: EARTH_VERT,
        fragmentShader: frag,
        ...extra,
      });
    const [ws, hs] = segments;
    this.surface = new THREE.Mesh(new THREE.SphereGeometry(1, ws, hs), mk(EARTH_FRAG, 1, 1));
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.018, Math.max(32, ws * 0.6) | 0, Math.max(20, hs * 0.6) | 0),
      mk(CLOUD_FRAG, 1.12, 0, { transparent: true, depthWrite: false, blending: THREE.NormalBlending })
    );
    const atmoMat = additiveKeepAlpha(mk(ATMO_FRAG, 1.3, 0, { side: THREE.BackSide }));
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.09, 48, 32), atmoMat);
    this.clouds.renderOrder = 3;
    this.atmo.renderOrder = 4;
    this.spinner = new THREE.Group();
    this.spinner.add(this.surface, this.clouds);
    this.object.add(this.spinner, this.atmo);
    this.object.rotation.z = 0.41; // axial tilt 23.4 degrees
    for (const m of [this.surface, this.clouds, this.atmo]) m.frustumCulled = false;
  }

  /** state: { pos: Vector3 (world), radius, axis, stretch, stress, lightCol[3], lightI, visibility, appear, time, dt } */
  update(s) {
    const u = this.shared;
    this.object.position.copy(s.pos);
    this.object.scale.setScalar(Math.max(1e-4, s.radius));
    this.spinner.rotation.y += s.dt * 0.12;
    this.clouds.rotation.y += s.dt * 0.018;
    u.uAxis.value.copy(s.axis);
    u.uStretch.value = s.stretch;
    u.uStress.value = s.stress;
    u.uLightDir.value.copy(s.axis);
    u.uLightCol.value.setRGB(s.lightCol[0], s.lightCol[1], s.lightCol[2]);
    u.uLightI.value = s.lightI;
    u.uVisibility.value = s.visibility;
    u.uAppear.value = s.appear;
    u.uTime.value = s.time;
  }
  setVisible(v) {
    this.object.visible = v;
  }
  dispose() {
    this.object.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}
