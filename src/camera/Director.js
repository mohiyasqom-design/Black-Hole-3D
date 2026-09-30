// Scripted camera + effect sequences: intro, enter, deeper, return, swoop,
// and the autonomous cinematic tour. Sequences only write camera goals and
// the engine's `fx` block, so the simulation keeps running underneath.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, easeInOutCubic } from '../utils/math.js';

const ORIGIN = new THREE.Vector3();

export class Director {
  constructor(engine) {
    this.e = engine;
    this.seq = null;
    this.tour = null;
  }
  play(seq) {
    this.seq?.cancel?.();
    this.seq = seq;
    seq.start?.();
  }
  get name() {
    return this.seq?.name ?? null;
  }
  /** Stop the running sequence, letting it restore rig and fx state. */
  cancel() {
    const s = this.seq;
    if (!s) return;
    this.seq = null;
    (s.cancel || s.finish)?.call(s);
  }
  update(dt) {
    if (this.tour) this.tour.update(dt);
    if (this.seq) {
      const done = this.seq.update(dt);
      if (done) {
        const s = this.seq;
        this.seq = null;
        s.finish?.();
      }
    }
  }
}

export class IntroSequence {
  constructor(e) {
    this.e = e;
    this.name = 'intro';
  }
  start() {
    const e = this.e;
    const rs = e.d.rsWorld;
    e.rig.setImmediate({ target: ORIGIN, yaw: 0.25, pitch: 0.34, dist: rs * 420, fov: 38 });
    e.rig.setGoal({ target: ORIGIN, yaw: 0.72, pitch: e.d.type.camPitch, dist: rs * e.d.type.camDist, fov: 50 }, 0.75);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 5 || this.e.rig.interacting) {
      return true;
    }
    return false;
  }
  finish() {
    this.e.rig.damping = 4.5;
  }
}

export class EnterSequence {
  constructor(e) {
    this.e = e;
    this.name = 'enter';
  }
  start() {
    const e = this.e;
    e.saveReturnPose();
    const r = e.rig;
    this.d0 = r.dist;
    this.p0 = r.pitch;
    this.y0 = r.yaw;
    this.tgt0 = r.target.clone();
    r.userEnabled = false;
    r.follow = null;
    r.autoRotate = 0;
    this.t = 0;
    this.crossed = false;
    this.switched = false;
    e.audio.enterStart();
  }
  skip() {
    if (this.t < 7.75) this.t = 7.75;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    const e = this.e;
    const fx = e.fx;
    if (!this.switched) {
      const H = e.d.horizon * e.d.rsWorld * 1.003;
      const k1 = smoothstep(0, 1.4, t);
      fx.timeWarp = lerp(1, 0.12, k1);
      const u = clamp((t - 1.0) / 6.8, 0, 1);
      const approach = Math.pow(u, 2.3);
      const dStart = Math.max(this.d0, H * 6);
      const dist = H * Math.exp(Math.log(dStart / H) * (1 - approach));
      const target = this.tgt0.clone().lerp(ORIGIN, k1);
      const shake = u * u * 0.0025;
      e.rig.setImmediate({
        target,
        yaw: this.y0 + 0.35 * smoothstep(0.5, 7.8, t) + Math.sin(t * 31) * shake,
        pitch: lerp(this.p0, 0.075, smoothstep(0, 2.2, t)) + Math.sin(t * 23) * shake,
        dist,
        fov: 50 + 34 * u * u * u,
        roll: 0.05 * u * u * Math.sin(t * 0.7),
      });
      fx.enter = smoothstep(1.0, 7.6, t);
      fx.streak = smoothstep(4.8, 7.8, t) * 0.85;
      fx.ca = smoothstep(3.0, 7.8, t) * 1.1;
      fx.vignette = lerp(0.55, 0.95, fx.enter);
    }
    if (t >= 7.75 && !this.crossed) {
      this.crossed = true;
      e.audio.crossHorizon();
    }
    if (t >= 7.75 && t < 8.05) {
      fx.flash = smoothstep(7.75, 7.92, t);
      fx.flashCol.setRGB(1, 0.9, 0.78);
    }
    if (t >= 8.05 && !this.switched) {
      this.switched = true;
      fx.enter = 0;
      fx.streak = 0;
      fx.ca = 0.35;
      fx.vignette = 0.75;
      e.setWorld('interior');
    }
    if (this.switched) {
      fx.flash = Math.max(0, 1 - (t - 8.05) / 0.35);
      fx.interiorIntensity = smoothstep(8.05, 9.4, t);
    }
    return t >= 9.4;
  }
  finish() {
    const e = this.e;
    e.fx.flash = 0;
    e.fx.interiorIntensity = 1;
    e.rig.userEnabled = true;
  }
  cancel() {
    this.finish();
  }
}

export class StageSequence {
  constructor(e, target) {
    this.e = e;
    this.target = target;
    this.name = target > 0.5 ? 'deeper' : 'rise';
  }
  start() {
    this.from = this.e.interiorStage;
    this.t = 0;
    this.e.audio.stage(this.target);
    this.e.rig.setGoal({ fov: this.target > 0.5 ? 64 : 58 }, 1.5);
  }
  update(dt) {
    this.t += dt;
    const k = easeInOutCubic(clamp(this.t / 3.6, 0, 1));
    this.e.interiorStage = lerp(this.from, this.target, k);
    const fx = this.e.fx;
    fx.flash = Math.max(0, Math.sin(clamp(this.t / 3.6, 0, 1) * Math.PI) * 0.18);
    fx.flashCol.setRGB(1, 0.92, 0.85);
    fx.ca = 0.35 + Math.sin(k * Math.PI) * 0.8;
    return this.t >= 3.6;
  }
  finish() {
    this.e.fx.flash = 0;
    this.e.fx.ca = 0.35;
  }
}

export class ReturnSequence {
  constructor(e) {
    this.e = e;
    this.name = 'return';
  }
  start() {
    this.t = 0;
    this.switched = false;
    this.e.rig.userEnabled = false;
    this.e.audio.returnOut();
  }
  update(dt) {
    this.t += dt;
    const e = this.e;
    const fx = e.fx;
    if (!this.switched) {
      fx.flash = smoothstep(0, 0.35, this.t);
      fx.flashCol.setRGB(0.92, 0.95, 1.0);
      if (this.t >= 0.38) {
        this.switched = true;
        e.setWorld('exterior');
        const pose = e.returnPose ?? e.defaultPose();
        e.rig.setImmediate({ ...pose, dist: pose.dist * 2.6, fov: 72, roll: 0 });
        e.rig.setGoal({ ...pose, fov: 50, roll: 0 }, 1.3);
        fx.enter = 0;
        fx.streak = 0;
        fx.ca = 0;
        fx.vignette = 0.55;
      }
    } else {
      fx.flash = Math.max(0, 1 - (this.t - 0.38) / 1.2);
      fx.timeWarp = lerp(fx.timeWarp, 1, 0.05);
    }
    return this.t >= 2.6;
  }
  finish() {
    const e = this.e;
    e.fx.flash = 0;
    e.fx.timeWarp = 1;
    e.rig.userEnabled = true;
    e.rig.damping = 4.5;
  }
}

/** Double-tap discovery: a sweeping cinematic orbit around the hole. */
export class SwoopSequence {
  constructor(e) {
    this.e = e;
    this.name = 'swoop';
  }
  start() {
    const r = this.e.rig;
    this.p0 = r.pose();
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const k = easeInOutCubic(clamp(this.t / 4.2, 0, 1));
    const r = this.e.rig;
    r.setGoal({
      target: this.p0.target,
      yaw: this.p0.yaw + k * Math.PI * 1.2,
      pitch: this.p0.pitch + Math.sin(k * Math.PI) * 0.35,
      dist: this.p0.dist * (1 - Math.sin(k * Math.PI) * 0.4),
    }, 3);
    return this.t >= 4.4 || (this.t > 0.3 && r.pointers.size > 0);
  }
  finish() {
    this.e.rig.damping = 4.5;
  }
}
