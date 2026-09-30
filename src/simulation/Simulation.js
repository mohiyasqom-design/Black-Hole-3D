// Simulation state, fully independent of rendering. Works in rs units.
//
// Earth orbit: relativistic-looking rosette. A tangential launch at distance r0
// with speed f * v_circ gives semi-latus rectum p = f^2 r0 and eccentricity
// e = |f^2 - 1| (exact for Newtonian gravity). Periapsis advances by the GR
// rate dω/dφ = 1.5 / p (rs units, weak-field formula), and orbits with p < 3 rs
// (inside the Schwarzschild ISCO) become unstable and plunge.
import { clamp, damp, TAU } from '../utils/math.js';
import { staticClockRate, circularClockRate, infallRedshift } from './physics.js';

export const STAGES = [
  'Normal',
  'Increased Gravitational Influence',
  'Orbital Instability',
  'Tidal Stress',
  'Severe Deformation',
  'Tidal Disruption',
];

export class DebrisBuffer {
  constructor(max) {
    this.max = max;
    this.limit = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.data = new Float32Array(max * 2); // life (-1 = dead), heat
    for (let i = 0; i < max; i++) this.data[i * 2] = -1;
    this.cursor = 0;
    this.activeCount = 0;
  }
  spawn(x, y, z, vx, vy, vz) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.limit;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.data[i * 2] = 0;
    this.data[i * 2 + 1] = 0.5;
  }
  clear() {
    for (let i = 0; i < this.max; i++) this.data[i * 2] = -1;
    this.activeCount = 0;
  }
  setLimit(n) {
    this.limit = Math.max(1, Math.min(this.max, n));
    for (let i = this.limit; i < this.max; i++) this.data[i * 2] = -1;
    this.cursor %= this.limit;
  }
  update(dt, GM, horizon, dirSign) {
    if (dt <= 0) return;
    const steps = dt > 0.02 ? 3 : 2;
    const h = dt / steps;
    let active = 0;
    const P = this.pos, V = this.vel, D = this.data;
    for (let i = 0; i < this.limit; i++) {
      if (D[i * 2] < 0) continue;
      let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      let vx = V[i * 3], vy = V[i * 3 + 1], vz = V[i * 3 + 2];
      let r = 1;
      for (let s = 0; s < steps; s++) {
        const r2 = x * x + y * y + z * z + 0.02;
        r = Math.sqrt(r2);
        const a = -GM / (r2 * r);
        vx += a * x * h; vy += a * y * h; vz += a * z * h;
        // gas drag circularizes debris into the disk plane (it becomes accretion flow)
        const rxz = Math.sqrt(x * x + z * z) + 1e-5;
        const vc = Math.sqrt(GM / Math.max(r, 0.5)) * dirSign;
        const tx = -z / rxz, tz = x / rxz;
        vx += (tx * vc - vx) * 0.22 * h;
        vz += (tz * vc - vz) * 0.22 * h;
        vy -= y * 0.9 * h;
        vy *= 1 - 0.3 * h;
        x += vx * h; y += vy * h; z += vz * h;
      }
      const life = D[i * 2] + dt;
      if (r < horizon * 1.15 || life > 40) {
        D[i * 2] = -1;
        continue;
      }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
      D[i * 2] = life;
      D[i * 2 + 1] = clamp(2.8 / r, 0, 1);
      active++;
    }
    this.activeCount = active;
  }
}

class EarthState {
  constructor(p) {
    this.nu = Math.random() * TAU;
    this.omega = 0;
    const f = p.earthVelocity;
    this.p = f * f * p.earthDistance;
    this.e = Math.min(Math.abs(f * f - 1), 0.9);
    this.sgn = f >= 1 ? 1 : -1;
    this.r = p.earthDistance;
    this.incl = (p.earthInclination * Math.PI) / 180;
    this.dir = p.earthDirection;
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.mass = 1;
    this.appear = 0;
    this.alive = true;
    this.swallowed = false;
    this.destroyed = false;
    this.unstable = false;
    this.stress = 0;
    this.stretch = 0;
    this.stage = 0;
    this.tau = 0;
    this.extreme = 0;
    this.fate = null;
    this._pred = Array.from({ length: 420 }, () => [0, 0, false]);
    this.place();
  }
  radiusAt(nu) {
    return this.p / (1 + this.sgn * this.e * Math.cos(nu));
  }
  place() {
    const r = this.radiusAt(this.nu);
    this.r = r;
    const phi = this.nu + this.omega;
    const x = r * Math.cos(phi), z = r * Math.sin(phi);
    this.pos[0] = x;
    this.pos[1] = -z * Math.sin(this.incl);
    this.pos[2] = z * Math.cos(this.incl);
  }
  /** Predict the path ahead with the same equations (no plunge decay). */
  predict(n, d) {
    let nu = this.nu, omega = this.omega;
    const pp = Math.max(this.p, 1.2);
    const span = TAU * 2.2;
    const dnu = (span / n) * this.dir;
    for (let i = 0; i < n; i++) {
      const r = Math.max(this.radiusAt(nu), d.horizon);
      const o = this._pred[i];
      o[0] = r; o[1] = nu + omega; o[2] = pp < 3 || r < 3;
      nu += dnu;
      omega += dnu * Math.min(1.5 / Math.max(pp, 1.5), 0.6);
    }
    return this._pred;
  }
}

export class Simulation {
  constructor(maxDebris) {
    this.time = 0; // distant-observer (coordinate) time
    this.realTime = 0;
    this.tauCam = 0;
    this.diskTime = 0;
    this.earth = null;
    this.probe = null;
    this.debris = new DebrisBuffer(maxDebris);
    this.events = [];
    this.gw = { t0: -100, t: 100, amp: 0 };
    this.camRate = 1;
    this.extremeUntil = 0;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  spawnEarth(p) {
    this.earth = new EarthState(p);
    this.debris.clear();
    this.emit('earth-spawn');
  }
  removeEarth() {
    this.earth = null;
  }

  dropProbe(camPosRs) {
    const len = Math.hypot(camPosRs[0], camPosRs[1], camPosRs[2]);
    let dir = len > 1e-3 ? camPosRs.map((c) => c / len) : [1, 0.25, 0];
    // start a little off the camera line so the fall is visible, and above the disk
    const r0 = clamp(len * 0.62, 6, 40);
    dir = [dir[0] * 0.94 + 0.2, Math.max(dir[1], 0.18), dir[2] * 0.94];
    const dl = Math.hypot(dir[0], dir[1], dir[2]);
    this.probe = {
      r: r0, r0, dir: dir.map((c) => c / dl), t: 0, tau: 0, g: infallRedshift(r0),
      nextPulse: 0.5, pulses: 0, pulseFlash: 0, lost: false, lostT: 0,
    };
    this.emit('probe-drop');
  }

  gwPulse() {
    this.gw.t0 = this.realTime;
    this.emit('gw');
  }

  update(dt, realDt, p, d, camR) {
    this.realTime += realDt;
    this.time += dt;
    this.diskTime += dt * p.diskSpeed * d.type.diskSpeed;
    this.camRate = staticClockRate(Math.max(camR, 1.0001));
    this.tauCam += dt * this.camRate;

    const gwT = this.realTime - this.gw.t0;
    this.gw.t = gwT;
    this.gw.amp = gwT < 9 ? Math.min(1, gwT * 3) * (1 - gwT / 9) : 0;

    const K = d.orbitK;
    const GM = K * K;
    this.updateEarth(dt, realDt, p, d, K);
    this.updateProbe(dt, realDt, d);
    this.debris.update(dt, GM, d.horizon, p.earthDirection);
  }

  updateEarth(dt, realDt, p, d, K) {
    const E = this.earth;
    if (!E || !E.alive) return;
    E.appear = Math.min(1, E.appear + realDt / 1.4);
    E.incl = damp(E.incl, (p.earthInclination * Math.PI) / 180, 3, realDt);
    E.dir = p.earthDirection;

    const f = p.earthVelocity;
    const pT = f * f * p.earthDistance;
    const eT = Math.min(Math.abs(f * f - 1), 0.9);
    E.p = damp(E.p, pT, 1.1, realDt);
    E.e = damp(E.e, eT, 1.1, realDt);
    E.sgn = f >= 1 ? 1 : -1;
    E.unstable = E.p < 3.0;
    if (E.unstable) E.p -= dt * (3.05 - E.p) * 1.1; // unstable orbit decays into a plunge
    E.p = Math.max(E.p, d.horizon * 0.5);

    const prev0 = E.pos[0], prev1 = E.pos[1], prev2 = E.pos[2];
    const r = Math.max(E.radiusAt(E.nu), d.horizon * 0.9);
    const dnu = clamp((E.dir * K * d.type.orbitTimeScale * Math.sqrt(Math.max(E.p, 0.2))) / (r * r) * dt, -0.5, 0.5);
    E.nu += dnu;
    E.omega += dnu * Math.min(1.5 / Math.max(E.p, 1.5), 0.6);
    E.place();
    if (dt > 0) {
      E.vel[0] = (E.pos[0] - prev0) / dt;
      E.vel[1] = (E.pos[1] - prev1) / dt;
      E.vel[2] = (E.pos[2] - prev2) / dt;
    }

    // Tides: stress = gain * (r_t / r)^3, with the tidal radius from real physics
    // (compressed into the scene for stellar holes, see derive.js).
    const extreme = this.realTime < this.extremeUntil ? 2.2 : 1;
    E.stress = p.tidalGain * extreme * Math.pow(d.tidalRadiusScene / E.r, 3);
    const S = E.stress;
    const target = clamp(0.55 * S + 1.6 * Math.pow(Math.max(0, S - 0.7), 1.5), 0, 7);
    E.stretch = damp(E.stretch, target, 4, realDt);
    E.tau += dt * circularClockRate(E.r);

    if (S >= 1) {
      const loss = dt * (S - 0.85) * 0.12;
      E.mass -= loss;
      const n = Math.min(80, Math.round(loss * 5200));
      this.shed(E, n, d);
      if (E.mass <= 0.03) {
        E.alive = false;
        E.destroyed = true;
        E.fate = 'destroyed';
        this.shed(E, 380, d);
        this.emit('earth-destroyed');
      }
    }
    if (E.alive && E.r < d.horizon * 1.05) {
      E.alive = false;
      E.swallowed = true;
      E.fate = S < 1 ? 'swallowed-intact' : 'swallowed';
      this.emit('earth-swallowed', { intact: S < 1 });
    }

    let stage = 0;
    if (S >= 1) stage = 5;
    else if (S >= 0.6) stage = 4;
    else if (S >= 0.3) stage = 3;
    else if (E.unstable) stage = 2;
    else if (S >= 0.08 || E.r < 9) stage = 1;
    if (stage !== E.stage) {
      E.stage = stage;
      this.emit('earth-stage', { stage });
    }
  }

  /** Stream material from the tidal points toward and away from the hole. */
  shed(E, n, d) {
    const [x, y, z] = E.pos;
    const r = Math.hypot(x, y, z) || 1;
    const ax = -x / r, ay = -y / r, az = -z / r;
    const R = (d.type.earthRadius / d.rsWorld) * (1 + E.stretch);
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.55 ? 1 : -1;
      const k = R * (0.6 + Math.random() * 0.5) * side;
      const j = () => (Math.random() - 0.5) * R * 0.5;
      const spread = 1 + side * (0.05 + Math.random() * 0.07);
      this.debris.spawn(
        x + ax * k + j(), y + ay * k + j(), z + az * k + j(),
        E.vel[0] * spread + (Math.random() - 0.5) * 0.3,
        E.vel[1] * spread + (Math.random() - 0.5) * 0.3,
        E.vel[2] * spread + (Math.random() - 0.5) * 0.3
      );
    }
  }

  updateProbe(dt, realDt, d) {
    const P = this.probe;
    if (!P) return;
    const cS = 2.6 * d.type.orbitTimeScale;
    // Schwarzschild coordinate speed for a radial fall from rest at infinity.
    const drdt = -(1 - 1 / P.r) * Math.sqrt(1 / P.r) * cS;
    P.r = Math.max(1.00005, P.r + drdt * dt);
    P.t += dt;
    const rate = Math.max(0, 1 - 1 / P.r); // dτ/dt along this geodesic
    P.tau += dt * rate;
    P.g = infallRedshift(P.r);
    P.pulseFlash = Math.max(0, P.pulseFlash - realDt * 2.5);
    if (P.tau >= P.nextPulse) {
      P.nextPulse += 0.5;
      P.pulses++;
      P.pulseFlash = 1;
    }
    if (!P.lost && P.g < 0.015) {
      P.lost = true;
      this.emit('probe-lost');
    }
    if (P.lost) {
      P.lostT += realDt;
      if (P.lostT > 6) this.probe = null;
    }
  }
}
