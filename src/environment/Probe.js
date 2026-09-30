import * as THREE from 'three';
import { BEACON_VERT, BEACON_FRAG } from '../shaders/particles.glsl.js';
import { additiveKeepAlpha } from '../blackhole/Jets.js';
import { blackbody } from '../utils/color.js';

/** Procedural probe: a tiny craft with a beacon. Replaceable by spacecraft.glb. */
export function buildProceduralProbe() {
  const g = new THREE.Group();
  const hull = new THREE.MeshLambertMaterial({ color: 0x8a847c });
  const panel = new THREE.MeshLambertMaterial({ color: 0x1d2433, emissive: 0x05070c });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 10), hull);
  body.rotation.z = Math.PI / 2;
  const wingGeo = new THREE.BoxGeometry(0.22, 0.004, 0.08);
  const w1 = new THREE.Mesh(wingGeo, panel);
  w1.position.set(0, 0, 0.17);
  const w2 = w1.clone();
  w2.position.z = -0.17;
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.04, 14, 1, true), hull);
  dish.position.x = 0.1;
  dish.rotation.z = -Math.PI / 2;
  g.add(body, w1, w2, dish);
  return g;
}

export class ProbeVisual {
  constructor() {
    this.group = new THREE.Group();
    this.craft = buildProceduralProbe();
    this.group.add(this.craft);
    this.uniforms = { uSize: { value: 1.4 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uRing: { value: 0 } };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    this.beacon = new THREE.Points(g, additiveKeepAlpha(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: BEACON_VERT, fragmentShader: BEACON_FRAG })));
    this.beacon.frustumCulled = false;
    this.group.add(this.beacon);
    // Trail
    this.trailN = 90;
    this.trailPos = new Float32Array(this.trailN * 3);
    this.trailCol = new Float32Array(this.trailN * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3).setUsage(THREE.DynamicDrawUsage));
    const tm = new THREE.LineBasicMaterial({ vertexColors: true });
    additiveKeepAlpha(tm);
    this.trail = new THREE.Line(tg, tm);
    this.trail.frustumCulled = false;
    this.root = new THREE.Group();
    this.root.add(this.group, this.trail);
    this.root.visible = false;
    this.trailFill = 0;
    this.pulseT = 0;
  }
  /** Swap in a GLB spacecraft without touching the rest of the system. */
  setModel(object) {
    this.group.remove(this.craft);
    this.craft = object;
    this.craft.scale.setScalar(0.25);
    this.group.add(this.craft);
  }
  reset() {
    this.trailFill = 0;
  }
  update(dt, probe, d, pixelRatio) {
    if (!probe) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const rs = d.rsWorld;
    const x = probe.dir[0] * probe.r * rs, y = probe.dir[1] * probe.r * rs, z = probe.dir[2] * probe.r * rs;
    this.group.position.set(x, y, z);
    this.group.scale.setScalar(Math.sqrt(rs) * 0.9);
    this.craft.rotation.y += dt * 0.4;
    const g = probe.g;
    const [r, gg, b] = blackbody(1800 + 9000 * g);
    const bright = g * g * 1.6;
    this.uniforms.uColor.value.setRGB(r * bright, gg * bright, b * bright);
    this.uniforms.uPixelRatio.value = pixelRatio;
    // pulse ring flashes whenever a pulse is emitted
    this.pulseT = probe.pulseFlash;
    this.uniforms.uRing.value = probe.pulseFlash;
    // trail
    if (this.trailFill < this.trailN) this.trailFill++;
    this.trailPos.copyWithin(3, 0, (this.trailN - 1) * 3);
    this.trailPos[0] = x; this.trailPos[1] = y; this.trailPos[2] = z;
    for (let i = 0; i < this.trailN; i++) {
      const f = i < this.trailFill ? (1 - i / this.trailN) * 0.5 * g : 0;
      this.trailCol[i * 3] = f; this.trailCol[i * 3 + 1] = f * 0.8; this.trailCol[i * 3 + 2] = f * 0.6;
    }
    // unfilled trail points collapse onto the head to avoid a line to the origin
    for (let i = this.trailFill; i < this.trailN; i++) {
      this.trailPos[i * 3] = x; this.trailPos[i * 3 + 1] = y; this.trailPos[i * 3 + 2] = z;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }
}
