import * as THREE from 'three';
import { clamp, damp, angleDelta } from '../utils/math.js';

/**
 * Spherical camera controller with critically-damped smoothing, touch-first
 * gestures (1 finger orbit, pinch zoom, 2 finger pan), mouse + wheel, and
 * tap / double-tap / long-press detection. In "look" mode (interior) the
 * camera stays put and gestures rotate the view instead.
 */
export class CameraRig {
  constructor(camera, dom, handlers = {}) {
    this.camera = camera;
    this.dom = dom;
    this.h = handlers;
    this.target = new THREE.Vector3();
    this.yaw = 0.7;
    this.pitch = 0.2;
    this.dist = 30;
    this.fov = 50;
    this.roll = 0;
    this.goal = { target: new THREE.Vector3(), yaw: 0.7, pitch: 0.2, dist: 30, fov: 50, roll: 0 };
    this.damping = 4.5;
    this.minDist = 2;
    this.maxDist = 400;
    this.allowPan = true;
    this.userEnabled = true;
    this.autoRotate = 0;
    this.follow = null;
    this.lookMode = false;
    this.lastInput = -10;
    this.clock = 0;
    this.pointers = new Map();
    this.gesture = null;
    this.zoomPush = 0;
    this._v = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this.bind();
  }

  bind() {
    const d = this.dom;
    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e);
    this._wheel = (e) => this.onWheel(e);
    this._ctx = (e) => e.preventDefault();
    d.addEventListener('pointerdown', this._down);
    d.addEventListener('pointermove', this._move);
    d.addEventListener('pointerup', this._up);
    d.addEventListener('pointercancel', this._up);
    d.addEventListener('wheel', this._wheel, { passive: false });
    d.addEventListener('contextmenu', this._ctx);
  }
  dispose() {
    const d = this.dom;
    d.removeEventListener('pointerdown', this._down);
    d.removeEventListener('pointermove', this._move);
    d.removeEventListener('pointerup', this._up);
    d.removeEventListener('pointercancel', this._up);
    d.removeEventListener('wheel', this._wheel);
    d.removeEventListener('contextmenu', this._ctx);
    clearTimeout(this.longTimer);
  }

  setGoal(g, damping) {
    if (g.target) this.goal.target.copy(g.target);
    if (g.yaw !== undefined) this.goal.yaw = this.yaw + angleDelta(this.yaw, g.yaw);
    if (g.pitch !== undefined) this.goal.pitch = g.pitch;
    if (g.dist !== undefined) this.goal.dist = g.dist;
    if (g.fov !== undefined) this.goal.fov = g.fov;
    if (g.roll !== undefined) this.goal.roll = g.roll;
    if (damping !== undefined) this.damping = damping;
  }
  setImmediate(g) {
    this.setGoal(g);
    this.target.copy(this.goal.target);
    this.yaw = this.goal.yaw;
    this.pitch = this.goal.pitch;
    this.dist = this.goal.dist;
    this.fov = this.goal.fov;
    this.roll = this.goal.roll;
  }
  pose() {
    return { target: this.target.clone(), yaw: this.yaw, pitch: this.pitch, dist: this.dist, fov: this.fov, roll: this.roll };
  }

  // --- input -------------------------------------------------------------
  onDown(e) {
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), button: e.button, shift: e.shiftKey });
    if (this.pointers.size === 1) {
      this.moved = false;
      clearTimeout(this.longTimer);
      const x = e.clientX, y = e.clientY;
      this.longTimer = setTimeout(() => {
        if (!this.moved && this.pointers.size === 1) {
          this.longFired = true;
          this.h.onLongPress?.(x, y);
        }
      }, 620);
      this.longFired = false;
    } else {
      clearTimeout(this.longTimer);
      this.moved = true;
      this.pinch = this.span();
    }
  }
  span() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) {
      if (!this.moved) clearTimeout(this.longTimer);
      this.moved = true;
    }
    if (!this.userEnabled || !this.moved) return;
    this.touch();
    const s = 1 / Math.max(320, Math.min(this.dom.clientWidth, this.dom.clientHeight));
    if (this.pointers.size >= 2) {
      const sp = this.span();
      if (sp && this.pinch) {
        const ratio = this.pinch.d / Math.max(sp.d, 1);
        this.zoom(ratio);
        if (this.allowPan && !this.lookMode) this.pan(sp.cx - this.pinch.cx, sp.cy - this.pinch.cy);
        this.pinch = sp;
      }
      return;
    }
    const panMode = p.button === 2 || p.button === 1 || p.shift;
    if (panMode && this.allowPan && !this.lookMode) {
      this.pan(dx, dy);
    } else {
      const k = this.lookMode ? 2.2 : 3.2;
      this.goal.yaw -= dx * s * k * (this.lookMode ? -1 : 1);
      this.goal.pitch = clamp(this.goal.pitch + dy * s * k * 0.8 * (this.lookMode ? -1 : 1), -1.45, 1.45);
    }
  }
  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    clearTimeout(this.longTimer);
    if (!p) return;
    if (this.pointers.size === 0 && !this.moved && !this.longFired && performance.now() - p.t < 320) {
      this.h.onTap?.(e.clientX, e.clientY);
    }
    if (this.pointers.size < 2) this.pinch = null;
  }
  onWheel(e) {
    e.preventDefault();
    if (!this.userEnabled) return;
    this.touch();
    this.zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0015));
  }
  zoom(ratio) {
    if (this.lookMode) {
      this.goal.fov = clamp(this.goal.fov * ratio, 35, 95);
      return;
    }
    const next = this.goal.dist * ratio;
    if (next > this.maxDist && ratio > 1) {
      this.zoomPush += ratio - 1;
      if (this.zoomPush > 0.6) {
        this.zoomPush = 0;
        this.h.onZoomBeyondMax?.();
      }
    }
    if (next < this.minDist && ratio < 1) this.h.onZoomBelowMin?.();
    this.goal.dist = clamp(next, this.minDist, this.maxDist);
  }
  pan(dx, dy) {
    if (this.follow) return;
    const cam = this.camera;
    this._r.setFromMatrixColumn(cam.matrixWorld, 0);
    this._u.setFromMatrixColumn(cam.matrixWorld, 1);
    const k = this.dist * 0.0016;
    this.goal.target.addScaledVector(this._r, -dx * k).addScaledVector(this._u, dy * k);
  }
  touch() {
    this.lastInput = this.clock;
    this.h.onUserInput?.();
  }
  get interacting() {
    return this.clock - this.lastInput < 2.5 || this.pointers.size > 0;
  }

  // --- per frame -----------------------------------------------------------
  update(dt) {
    this.clock += dt;
    if (this.follow) this.goal.target.copy(this.follow());
    if (this.autoRotate && !this.interacting) this.goal.yaw += this.autoRotate * dt;
    const k = this.damping;
    // A followed target moves on its own; track it tightly so it never drifts out of frame.
    this.followBlend = this.follow ? Math.min(1, (this.followBlend || 0) + dt / 1.6) : 0;
    const kt = k + this.followBlend * 14;
    this.target.x = damp(this.target.x, this.goal.target.x, kt, dt);
    this.target.y = damp(this.target.y, this.goal.target.y, kt, dt);
    this.target.z = damp(this.target.z, this.goal.target.z, kt, dt);
    this.yaw = damp(this.yaw, this.goal.yaw, k, dt);
    this.pitch = damp(this.pitch, this.goal.pitch, k, dt);
    this.dist = Math.exp(damp(Math.log(this.dist), Math.log(this.goal.dist), k, dt));
    this.fov = damp(this.fov, this.goal.fov, k * 0.8, dt);
    this.roll = damp(this.roll, this.goal.roll, k, dt);
    this.apply();
  }

  apply() {
    const cam = this.camera;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    if (this.lookMode) {
      cam.position.set(0, 0, 0);
      this._v.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
      cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
      cam.lookAt(this._v);
    } else {
      this._v.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.dist);
      cam.position.copy(this.target).add(this._v);
      cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
      cam.lookAt(this.target);
    }
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }
}
