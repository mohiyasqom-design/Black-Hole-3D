// Autonomous cinematic showcase. Each shot has a caption, a duration, an
// optional setup, and a camera path. Designed for 9:16 and 16:9 recordings.
import * as THREE from 'three';
import { lerp, easeOutQuint, clamp } from '../utils/math.js';

const O = new THREE.Vector3();

function shots(e) {
  const rs = () => e.d.rsWorld;
  return [
    { id: 'shadow', title: 'The Shadow', sub: 'Light bends around nothing at all', dur: 7,
      pose: (t) => ({ target: O, yaw: 0.35 + t * 0.03, pitch: 0.1, dist: rs() * lerp(70, 30, easeOutQuint(t / 7)), fov: 48 }) },
    { id: 'disk', title: 'Accretion', sub: 'Gas at millions of kelvin, spiralling in', dur: 7,
      pose: (t) => ({ target: O, yaw: 1.2 + t * 0.07, pitch: 0.035, dist: rs() * 12.5, fov: 52 }) },
    { id: 'jets', title: 'Relativistic Jets', sub: 'Plasma launched along the spin axis', dur: 6,
      setup: () => e.tourOverride({ jetPower: Math.max(e.params.jetPower, 1.3) }),
      pose: (t) => ({ target: O, yaw: 2.2 + t * 0.05, pitch: lerp(0.75, 1.05, t / 6), dist: rs() * 48, fov: 50 }) },
    { id: 'lensing', title: 'Gravitational Lensing', sub: 'The sky behind, folded around the edge', dur: 6,
      pose: (t) => ({ target: O, yaw: 3.1 + t * 0.05, pitch: -0.12, dist: rs() * 17, fov: 50 }) },
    { id: 'earth', title: 'Enter Earth', sub: 'A familiar world, far from home', dur: 7,
      setup: () => { e.tourOverride({ earthDistance: 16, earthVelocity: 1, tidalGain: 1 }); if (!e.sim.earth || !e.sim.earth.alive) e.addEarth(); },
      pose: () => {
        const E = e.earthWorld();
        if (!E) return null;
        const yaw = Math.atan2(E.x, E.z) + 0.25;
        return { target: E, yaw, pitch: 0.12, dist: e.d.type.earthRadius * 9, fov: 46 };
      } },
    { id: 'tides', title: 'Tidal Forces', sub: 'Stretched, then torn apart', dur: 9,
      setup: () => e.tourOverride({ earthDistance: e.d.tidalRadiusScene * 0.78, tidalGain: 1.4 }),
      pose: (t) => {
        const E = e.earthWorld();
        const ang = E ? Math.atan2(E.x, E.z) : t * 0.1;
        return { target: O, yaw: ang + 0.9, pitch: 0.32, dist: rs() * 22, fov: 50 };
      } },
    { id: 'horizon', title: 'Event Horizon', sub: 'The point of no return', dur: 5,
      pose: (t) => ({ target: O, yaw: 4.2 + t * 0.04, pitch: 0.04, dist: rs() * 2.5, fov: 55 }) },
    { id: 'enter', title: 'Crossing', sub: 'Time runs differently here', dur: 0, action: () => e.enter() },
    { id: 'interior', title: 'Inside', sub: 'Hypothetical visualization', dur: 7 },
    { id: 'singularity', title: 'Singularity', sub: 'Where known physics ends', dur: 8, action: () => e.goDeeper() },
    { id: 'return', title: 'Return to Observation', sub: 'Black Hole Laboratory', dur: 0, action: () => e.returnToObservation() },
  ];
}

export class Tour {
  constructor(e, { loop = false } = {}) {
    this.e = e;
    this.loop = loop;
    this.shots = shots(e);
    this.i = -1;
    this.t = 0;
    this.snapshot = { ...e.params };
    this.hadEarth = !!(e.sim.earth && e.sim.earth.alive);
  }
  get caption() {
    const s = this.shots[this.i];
    return s ? { title: s.title, sub: s.sub, index: this.i + 1, total: this.shots.length } : null;
  }
  start() {
    this.next();
  }
  next() {
    this.i++;
    this.t = 0;
    if (this.i >= this.shots.length) {
      if (this.loop) {
        this.e.store.set(this.snapshot);
        this.e.removeEarth();
        this.i = 0;
      } else {
        this.e.stopTour();
        return;
      }
    }
    const s = this.shots[this.i];
    s.setup?.();
    s.action?.();
  }
  update(dt) {
    const e = this.e;
    if (e.director.seq && e.director.seq.name !== 'intro') return; // wait for enter / deeper / return
    const s = this.shots[this.i];
    if (!s) return;
    this.t += dt;
    if (s.pose && e.world === 'exterior') {
      const pose = s.pose(clamp(this.t, 0, s.dur));
      if (pose) e.rig.setGoal(pose, 1.4);
    }
    if (this.t >= s.dur) this.next();
  }
  stop() {
    this.e.store.set(this.snapshot);
    if (!this.hadEarth) this.e.removeEarth();
  }
}
