import * as THREE from 'three';
import { ProceduralEarth } from './ProceduralEarth.js';
import { GLBEarth } from './GLBEarth.js';

/** Last-resort Earth for devices where the procedural shaders fail to compile. */
class SimpleEarth {
  constructor() {
    this.kind = 'simple';
    this.object = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshLambertMaterial({ color: 0x2a5d8f, emissive: 0x020409 }));
  }
  update(s) {
    this.object.position.copy(s.pos);
    const k = 1 + s.stretch;
    this.object.scale.setScalar(Math.max(1e-4, s.radius));
    this.object.lookAt(0, 0, 0);
    this.object.scale.z *= k;
  }
  setVisible(v) {
    this.object.visible = v;
  }
  dispose() {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}

/** Asset abstraction: prefer the Blender GLB when present, otherwise procedural. */
export function createEarthVisual(registry, tier, broken = false) {
  if (broken) return new SimpleEarth();
  const model = registry?.get('earth');
  if (model) {
    try {
      return new GLBEarth(model.clone(true));
    } catch (e) {
      console.warn('[BHL] earth.glb unusable, using procedural Earth', e);
    }
  }
  return new ProceduralEarth(tier.earthSeg);
}
