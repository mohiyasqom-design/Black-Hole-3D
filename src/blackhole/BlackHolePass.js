import * as THREE from 'three';
import { FULLSCREEN_VERT } from '../shaders/common.glsl.js';
import { BLACKHOLE_FRAG, BLACKHOLE_SAFE_FRAG } from '../shaders/blackhole.glsl.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Owns the ray-traced black hole material. Quality tiers change the number of
 * integration steps (compile-time loop bound) and sky detail.
 */
export class BlackHolePass {
  constructor(tier) {
    this.uniforms = {
      uScene: { value: null },
      uSceneDepth: { value: null },
      uCamPos: { value: new THREE.Vector3() },
      uCamWorld: { value: new THREE.Matrix4() },
      uInvProj: { value: new THREE.Matrix4() },
      uViewProj: { value: new THREE.Matrix4() },
      uInvViewProj: { value: new THREE.Matrix4() },
      uRs: { value: 1 },
      uSpin: { value: 0 },
      uLens: { value: 1 },
      uHorizon: { value: 1 },
      uPhotonR: { value: 1.5 },
      uDiskIn: { value: 3 },
      uDiskOut: { value: 12 },
      uDiskTemp: { value: 6000 },
      uDiskDensity: { value: 1 },
      uDiskThick: { value: 0.08 },
      uDiskBright: { value: 1 },
      uDiskTime: { value: 0 },
      uDoppler: { value: 0.85 },
      uRing: { value: 1 },
      uRingCol: { value: new THREE.Vector3(1, 0.8, 0.6) },
      uHotCol: { value: new THREE.Vector3(1, 0.8, 0.6) },
      uCoolCol: { value: new THREE.Vector3(1, 0.4, 0.1) },
      uStarDensity: { value: 1 },
      uStarBright: { value: 1 },
      uTime: { value: 0 },
      uMode: { value: 0 },
      uEnter: { value: 0 },
      uIsolate: { value: 0 },
    };
    this.material = this.build(tier);
    this.safe = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLACKHOLE_SAFE_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.useSafe = false;
  }

  build(tier) {
    return new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLACKHOLE_FRAG,
      defines: { MAX_STEPS: tier.steps, STEP_K: tier.stepK.toFixed(3), STAR_QUALITY: tier.starQ },
      depthTest: false,
      depthWrite: false,
    });
  }

  setTier(tier) {
    const old = this.material;
    this.material = this.build(tier);
    old.dispose();
  }

  get active() {
    return this.useSafe ? this.safe : this.material;
  }

  /** Copy camera matrices after the scene pass has updated them. */
  setCamera(camera) {
    const u = this.uniforms;
    u.uCamPos.value.copy(camera.position);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uInvViewProj.value.copy(u.uViewProj.value).invert();
  }

  update(p, d, fx, time, diskTime, intro) {
    const u = this.uniforms;
    u.uRs.value = d.rsWorld;
    u.uSpin.value = p.spin;
    u.uLens.value = p.lensing * (1 + 0.55 * fx.enter);
    u.uHorizon.value = d.horizon;
    u.uPhotonR.value = 1.5;
    u.uDiskIn.value = d.diskIn;
    u.uDiskOut.value = d.diskOut;
    u.uDiskTemp.value = p.diskTemp;
    u.uDiskDensity.value = p.diskDensity;
    u.uDiskThick.value = d.type.diskThickness;
    const ignite = intro < 1 ? Math.pow(intro, 2.2) * (1 + 0.8 * Math.sin(Math.min(intro, 1) * Math.PI)) : 1;
    u.uDiskBright.value = d.type.diskBright * ignite;
    u.uDiskTime.value = diskTime;
    u.uDoppler.value = p.doppler;
    u.uRing.value = p.photonRing * (1 + 2 * fx.enter) * (0.4 + 0.6 * Math.min(1, intro * 1.6));
    u.uRingCol.value.copy(v3(d.ringCol));
    u.uHotCol.value.copy(v3(d.hotCol));
    u.uCoolCol.value.copy(v3(d.coolCol));
    u.uStarDensity.value = p.starDensity;
    u.uStarBright.value = Math.min(1, intro * 2.5);
    u.uTime.value = time;
    u.uMode.value = p.eht ? 4 : p.vizMode;
    u.uEnter.value = fx.enter;
    u.uIsolate.value += ((p.isolate ? 1 : 0) - u.uIsolate.value) * 0.08;
  }

  dispose() {
    this.material.dispose();
    this.safe.dispose();
  }
}
