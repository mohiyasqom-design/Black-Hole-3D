import * as THREE from 'three';

/**
 * Wraps a Blender-exported Earth (earth.glb) behind the same interface as
 * ProceduralEarth. Tidal stretch is applied with an axis-aligned non-uniform
 * scale, which reads well for artist-made meshes that keep their materials.
 */
export class GLBEarth {
  constructor(model) {
    this.kind = 'glb';
    this.object = new THREE.Group();
    this.align = new THREE.Group(); // local +Y points toward the black hole
    this.stretch = new THREE.Group();
    this.counter = new THREE.Group(); // undoes the alignment for the model's own orientation
    this.spinner = new THREE.Group();
    this.model = model;
    // Normalize the model to a unit radius.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) / 2 || 1;
    model.scale.multiplyScalar(1 / r);
    this.spinner.add(model);
    this.counter.add(this.spinner);
    this.stretch.add(this.counter);
    this.align.add(this.stretch);
    this.object.add(this.align);
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this.lights = model.getObjectByProperty('isLight', true);
  }
  update(s) {
    this.object.position.copy(s.pos);
    this.object.scale.setScalar(Math.max(1e-4, s.radius));
    this._q.setFromUnitVectors(this._up, s.axis);
    this.align.quaternion.copy(this._q);
    this.counter.quaternion.copy(this._q).invert();
    const k = 1 + s.stretch;
    this.stretch.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
    this.spinner.rotation.y += s.dt * 0.12;
  }
  setVisible(v) {
    this.object.visible = v;
  }
  dispose() {
    this.object.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
