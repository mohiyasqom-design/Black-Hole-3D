// The engine owns the render loop, the simulation, and every visual system.
// React never re-renders per frame: the UI reads `engine.telemetry` at a few Hz
// and writes parameters into the store, which the engine reads each frame.
import * as THREE from 'three';
import { QUALITY, MAX_PARTICLES } from '../data/quality.js';
import { PRESETS, SECRET_GARGANTUA } from '../data/presets.js';
import { defaultParams, sanitize, typeDefaults } from '../data/params.js';
import { BH_TYPES } from '../data/blackholes.js';
import { derive } from './derive.js';
import { clamp, damp, easeOutQuint, fmt, angleDelta } from '../utils/math.js';
import { isMobileDevice } from '../utils/capabilities.js';
import { PerfMonitor } from '../utils/PerfMonitor.js';
import { RenderPipeline } from '../effects/RenderPipeline.js';
import { BlackHolePass } from '../blackhole/BlackHolePass.js';
import { Jets } from '../blackhole/Jets.js';
import { DiskDust } from '../blackhole/DiskDust.js';
import { SpacetimeGrid } from '../environment/SpacetimeGrid.js';
import { OrbitPath } from '../environment/OrbitPath.js';
import { DebrisField } from '../environment/DebrisField.js';
import { ProbeVisual } from '../environment/Probe.js';
import { createEarthVisual } from '../earth/createEarth.js';
import { Simulation, STAGES } from '../simulation/Simulation.js';
import { staticClockRate, circularClockRate, circularSpeedC, tidalAcceleration, G_EARTH } from '../simulation/physics.js';
import { CameraRig } from '../camera/CameraRig.js';
import { Director, IntroSequence, EnterSequence, StageSequence, ReturnSequence, SwoopSequence } from '../camera/Director.js';
import { Tour } from '../camera/Tour.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { AssetRegistry } from '../assets/AssetRegistry.js';

const O = new THREE.Vector3();
export const DISCOVERY_TOTAL = 6;

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export class Engine {
  constructor({ canvas, container, store, onEvent }) {
    this.canvas = canvas;
    this.container = container;
    this.store = store;
    this.onEvent = onEvent || (() => {});
    this.labelSink = null;
    this.running = false;
  }

  get params() {
    return this.store.get();
  }
  emit(ev) {
    try {
      this.onEvent(ev);
    } catch (e) {
      console.error(e);
    }
  }

  async init() {
    const p = this.params;
    this.mobile = isMobileDevice();
    const R = (this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    }));
    R.outputColorSpace = THREE.LinearSRGBColorSpace;
    R.toneMapping = THREE.NoToneMapping;
    R.setClearColor(0x000000, 0);
    R.debug.onShaderError = (gl, program, vs, fs) => this.onShaderError(gl, program, vs, fs);
    this._lost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.emit({ type: 'toast', title: 'Graphics context lost', sub: 'Recovering\u2026' });
    };
    this._restored = () => {
      this.contextLost = false;
      this.emit({ type: 'toast', title: 'Graphics restored' });
    };
    this.canvas.addEventListener('webglcontextlost', this._lost);
    this.canvas.addEventListener('webglcontextrestored', this._restored);

    this.qualityMode = p.quality;
    this.tier = this.resolveTier(p.quality);
    this.resScale = this.tier.scale * (this.qualityMode === 'auto' && this.mobile ? 0.85 : 1);
    this.lowCount = 0;
    this.highCount = 0;
    this.upgrades = 0;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.02, 20000);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.08));
    this.diskLight = new THREE.PointLight(0xffc890, 2.2, 0, 0);
    this.scene.add(this.diskLight);

    this.pipeline = new RenderPipeline(R);
    this.bh = new BlackHolePass(this.tier);
    this.jets = new Jets();
    this.dust = new DiskDust();
    this.grid = new SpacetimeGrid();
    this.orbit = new OrbitPath();
    this.sim = new Simulation(MAX_PARTICLES.debris);
    this.debrisField = new DebrisField(this.sim.debris);
    this.probeVis = new ProbeVisual();
    this.scene.add(this.jets.points, this.dust.points, this.grid.mesh, this.orbit.line, this.debrisField.points, this.probeVis.root);
    this.applyTierCounts();

    this.registry = new AssetRegistry();
    await this.registry.init();
    const craft = this.registry.get('spacecraft');
    if (craft) this.probeVis.setModel(craft.clone(true));
    const station = this.registry.get('station');
    if (station) {
      this.station = station;
      this.scene.add(station);
    }
    const shards = this.registry.get('debris');
    if (shards) {
      this.shards = shards;
      this.scene.add(shards);
    }
    this.earthVis = null;
    this.earthBroken = false;

    this.rig = new CameraRig(this.camera, this.canvas, {
      onTap: (x, y) => this.onTap(x, y),
      onLongPress: (x, y) => this.onLongPress(x, y),
      onZoomBeyondMax: () => this.onZoomBeyondMax(),
      onZoomBelowMin: () => this.onZoomBelowMin(),
      onUserInput: () => this.onUserInput(),
    });
    this.director = new Director(this);
    this.audio = new AudioEngine();
    this.perf = new PerfMonitor();
    this.fx = {
      enter: 0, streak: 0, ca: 0, flash: 0, flashCol: new THREE.Color(1, 1, 1), fade: 0,
      vignette: 0.55, timeWarp: 1, interiorIntensity: 1, letterbox: 0,
    };
    this.world = 'exterior';
    this.interiorStage = 0;
    this.intro = 0;
    this.jetTime = 0;
    this.cameraMode = 'blackhole';
    this.deepUnlocked = false;
    this.showcase = false;
    this.taps = { count: 0, kind: null, timer: null };
    this.discoveries = new Set();
    try {
      JSON.parse(localStorage.getItem('bhl.discoveries') || '[]').forEach((d) => this.discoveries.add(d));
    } catch (e) { /* storage unavailable */ }

    this._p = p;
    this.d = derive(p);
    this._earthW = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this.labels = {};
    this.telemetry = { earth: { active: false }, probe: { active: false } };

    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.container);
    this._vis = () => {
      this.last = performance.now();
    };
    document.addEventListener('visibilitychange', this._vis);

    this.applyCameraLimits();
    this.director.play(new IntroSequence(this));
    this.updateTelemetry(p, this.d, this.d.type.camDist);
    return this;
  }

  resolveTier(q) {
    if (q === 'auto') return QUALITY[this.mobile ? 'medium' : 'high'];
    return QUALITY[q] ?? QUALITY.medium;
  }
  applyTierCounts() {
    this.jets.setCount(this.tier.jets);
    this.dust.setCount(this.tier.dust);
    this.sim.debris.setLimit(this.tier.debris);
  }
  setTier(tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    this.bh.setTier(tier);
    this.applyTierCounts();
    if (this.earthVis && this.earthVis.kind === 'procedural') {
      this.scene.remove(this.earthVis.object);
      this.earthVis.dispose();
      this.earthVis = null;
    }
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      try {
        this.frame(now);
      } catch (e) {
        console.error('[BHL] frame error', e);
        this.frameErrors = (this.frameErrors || 0) + 1;
        if (this.frameErrors > 30) {
          this.running = false;
          this.emit({ type: 'fatal', error: e });
        }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this._ro?.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    this.canvas.removeEventListener('webglcontextlost', this._lost);
    this.canvas.removeEventListener('webglcontextrestored', this._restored);
    this.rig?.dispose();
    this.audio?.dispose();
    this.recorder?.stop();
    this.bh?.dispose();
    this.pipeline?.dispose();
    this.earthVis?.dispose();
    this.renderer?.dispose();
  }

  onShaderError(gl, program, vs, fs) {
    const src = gl.getShaderSource(fs) || '';
    const log = `${gl.getProgramInfoLog(program) || ''}\n${gl.getShaderInfoLog(vs) || ''}\n${gl.getShaderInfoLog(fs) || ''}`;
    console.error('[BHL] shader failed, switching to fallback\n', log);
    if (src.includes('BH_MAIN')) this.bh.useSafe = true;
    else if (src.includes('INTERIOR_MAIN')) this.pipeline.useSafeInterior = true;
    else if (src.includes('EARTH_SURFACE')) {
      this.earthBroken = true;
      if (this.earthVis) {
        this.scene.remove(this.earthVis.object);
        this.earthVis = null;
      }
    }
    this.safeMode = true;
    this.emit({ type: 'toast', title: 'Safe rendering enabled', sub: 'A shader was not supported on this device.' });
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.tier.pr);
    this.pr = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const s = this.params.eht ? 0.22 : this.resScale;
    this.pipeline.setSize(w * pr * s, h * pr * s);
    this.pipeline.postUniforms.uRes.value.set(w * pr, h * pr);
    this.viewW = w;
    this.viewH = h;
  }

  adapt() {
    if (this.qualityMode !== 'auto' || this.director.name === 'enter' || this.intro < 1) return;
    const fps = this.perf.fps;
    const t = this.tier;
    if (fps < 44) {
      this.highCount = 0;
      this.lowCount++;
      if (this.resScale > t.minScale + 0.01) {
        this.resScale = Math.max(t.minScale, this.resScale * 0.86);
        this.resize();
      } else if (this.lowCount > 2) {
        const down = t.id === 'high' ? 'medium' : t.id === 'medium' ? 'low' : null;
        if (down) {
          this.setTier(QUALITY[down]);
          this.resScale = this.tier.scale * 0.9;
          this.resize();
        }
        this.lowCount = 0;
      }
    } else if (fps > 57) {
      this.lowCount = 0;
      if (++this.highCount >= 3) {
        this.highCount = 0;
        if (this.resScale < t.scale - 0.01) {
          this.resScale = Math.min(t.scale, this.resScale * 1.08);
          this.resize();
        } else if (this.upgrades < 2) {
          const up = t.id === 'low' ? 'medium' : t.id === 'medium' && !this.mobile ? 'high' : null;
          if (up) {
            this.upgrades++;
            this.setTier(QUALITY[up]);
            this.resScale = this.tier.minScale + 0.1;
            this.resize();
          }
        }
      }
    } else {
      this.lowCount = 0;
      this.highCount = 0;
    }
  }

  // --- frame ----------------------------------------------------------------
  frame(now) {
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, raw);
    this.last = now;
    if (this.contextLost) return;
    if (raw < 1) this.perf.tick(raw); // true frame time; skip tab-switch gaps
    if (this.perf.sampleReady) this.adapt();

    const p = this.params;
    if (p !== this._p) {
      const prev = this._p;
      this._p = p;
      this.d = derive(p);
      if (prev.eht !== p.eht) this.resize();
      if (prev.bhType !== p.bhType || prev.mass !== p.mass) this.applyCameraLimits();
    }
    const d = this.d;
    if (this.pendingCamMode) {
      const m = this.pendingCamMode;
      this.pendingCamMode = null;
      this.setCameraMode(m);
    }
    this.intro = Math.min(1, this.intro + dt / 3.4);
    this.director.update(dt);
    // Earth focus co-rotates with the orbit so the hole stays behind the planet.
    const Ef = this.sim.earth;
    if (this.cameraMode === 'earth' && Ef && Ef.alive && this.world === 'exterior') {
      const ang = Math.atan2(Ef.pos[0], Ef.pos[2]);
      if (this._earthAng !== undefined) {
        const da = angleDelta(this._earthAng, ang);
        this.rig.goal.yaw += da;
        this.rig.yaw += da;
      }
      this._earthAng = ang;
    } else this._earthAng = undefined;
    this.rig.update(dt);

    const camR = this.camera.position.length() / d.rsWorld;
    const simDt = p.paused ? 0 : dt * p.simSpeed * this.fx.timeWarp;
    this.jetTime += simDt;
    this.sim.update(simDt, dt, p, d, this.world === 'exterior' ? camR : 1e6);
    this.drainEvents();

    const lb = this.showcase ? (this.viewW < this.viewH ? 0.055 : 0.1) : 0;
    this.fx.letterbox = damp(this.fx.letterbox, lb, 3, dt);

    this.updateVisuals(dt, p, d);
    this.render(p, d);
    if (this.captureRequested) {
      this.captureRequested = false;
      this.doCapture();
    }
    this.updateLabels();
    this.updateTelemetry(p, d, camR);
    const inside = this.world === 'interior';
    this.audio.update(dt, {
      clockRate: inside ? 0.15 : this.sim.camRate,
      world: this.world,
      stage: this.interiorStage,
      diskEnergy: clamp(p.diskDensity * (0.3 + p.diskSpeed * 0.35) * (p.paused ? 0.3 : 1), 0, 1),
    });
  }

  updateVisuals(dt, p, d) {
    this.jets.update(this.jetTime, p, d, this.pr);
    this.dust.update(this.sim.diskTime, p, d, this.pr, this.intro);
    const E = this.sim.earth;
    let earthWorld = null;
    if (E && E.alive) {
      if (!this.earthVis) {
        this.earthVis = createEarthVisual(this.registry, this.tier, this.earthBroken);
        this.scene.add(this.earthVis.object);
      }
      earthWorld = this._earthW.set(E.pos[0], E.pos[1], E.pos[2]).multiplyScalar(d.rsWorld);
      const axis = this._axis.copy(earthWorld).negate().normalize();
      const radius = d.type.earthRadius * Math.cbrt(Math.max(E.mass, 0.001)) * easeOutQuint(E.appear);
      this.earthVis.setVisible(true);
      this.earthVis.update({
        pos: earthWorld, radius, axis, stretch: E.stretch, stress: E.stress,
        lightCol: d.lightCol, lightI: clamp(18 / E.r, 0.55, 2.6) * (p.eht ? 0.5 : 1),
        visibility: Math.pow(staticClockRate(Math.max(E.r, 1.0001)), 0.6),
        appear: E.appear, time: this.sim.realTime, dt,
      });
      if (E.stress >= 1 && Math.random() < 0.05) this.audio.crackle();
    } else if (this.earthVis) {
      this.earthVis.setVisible(false);
    }
    const live = E && E.alive ? E : null;
    this.orbit.update(dt, p.orbitPath || p.grid, live, p, d);
    this.grid.update(dt, p.grid || this.sim.gw.amp > 0, d, p, earthWorld, live ? live.mass : 0, this.sim.gw);
    this.debrisField.update(d, this.pr);
    this.probeVis.update(dt, this.sim.probe, d, this.pr);
    this.diskLight.color.setRGB(d.lightCol[0], d.lightCol[1], d.lightCol[2]);
    this.diskLight.intensity = 2.2 * p.diskDensity;
    if (this.station) this.station.position.set(-70, 22, -110).multiplyScalar(d.rsWorld);
    if (this.shards) {
      this.shards.scale.setScalar(d.rsWorld);
      this.shards.rotation.y = -this.sim.diskTime * 0.03;
    }
  }

  render(p, d) {
    const R = this.renderer;
    const P = this.pipeline;
    const fx = this.fx;
    if (this.world === 'exterior') {
      R.setRenderTarget(P.sceneRT);
      R.render(this.scene, this.camera);
      const u = this.bh.uniforms;
      u.uScene.value = P.sceneRT.texture;
      u.uSceneDepth.value = P.sceneRT.depthTexture;
      this.bh.setCamera(this.camera);
      this.bh.update(p, d, fx, this.sim.realTime, this.sim.diskTime, this.intro);
      P.quadTo(this.bh.active, P.bhRT);
    } else {
      const iu = P.interiorUniforms;
      this.camera.updateMatrixWorld();
      iu.uCamWorld.value.copy(this.camera.matrixWorld);
      iu.uInvProj.value.copy(this.camera.projectionMatrixInverse);
      iu.uTime.value = this.sim.realTime;
      iu.uStage.value = this.interiorStage;
      iu.uIntensity.value = fx.interiorIntensity;
      iu.uSpin.value = p.spin;
      iu.uHotCol.value.set(d.hotCol[0], d.hotCol[1], d.hotCol[2]);
      iu.uCoolCol.value.set(0.35, 0.45, 0.95);
      P.quadTo(P.useSafeInterior ? P.interiorSafe : P.interior, P.bhRT);
    }
    const pu = P.postUniforms;
    pu.uTime.value = this.sim.realTime;
    pu.uExposure.value = p.exposure;
    pu.uCA.value = fx.ca;
    pu.uStreak.value = fx.streak;
    pu.uBlur.value = p.eht && this.world === 'exterior' ? 2.5 : 0;
    pu.uVignette.value = fx.vignette;
    pu.uGrain.value = 1;
    pu.uFlash.value = fx.flash;
    pu.uFlashCol.value.copy(fx.flashCol);
    pu.uFade.value = fx.fade;
    pu.uLetterbox.value = fx.letterbox;
    pu.uGw.value = this.world === 'exterior' ? this.sim.gw.amp : 0;
    pu.uGwR.value = this.sim.gw.t * 0.35;
    const c = this._tmp.set(0, 0, 0).project(this.camera);
    if (c.z < 1) pu.uCenter.value.set(clamp((c.x + 1) / 2, -0.5, 1.5), clamp((c.y + 1) / 2, -0.5, 1.5));
    else pu.uCenter.value.set(0.5, 0.5);
    P.quadTo(P.post, null);
  }

  drainEvents() {
    const ev = this.sim.events;
    if (!ev.length) return;
    for (const e of ev) {
      switch (e.type) {
        case 'earth-spawn':
          this.emit({ type: 'toast', title: 'Earth added', sub: 'Its day side faces the disk, the only light here' });
          break;
        case 'earth-stage':
          if (e.stage === 2) this.emit({ type: 'toast', title: 'Orbital instability', sub: 'Inside 3 r\u209B no stable orbit exists. Pull Earth out or watch it plunge.', tone: 'warn' });
          if (e.stage === 5) {
            this.emit({ type: 'toast', title: 'Tidal disruption', sub: 'Gravity differences now exceed Earth\u2019s own gravity', tone: 'warn' });
            this.audio.crackle();
          }
          break;
        case 'earth-destroyed':
          if (this.cameraMode === 'earth') this.pendingCamMode = 'blackhole';
          this.emit({ type: 'toast', title: 'Earth torn apart', sub: 'Its debris is joining the accretion disk', tone: 'warn' });
          this.audio.boom(70, 30, 2, 0.25);
          break;
        case 'earth-swallowed':
          if (this.cameraMode === 'earth') this.pendingCamMode = 'blackhole';
          this.emit({
            type: 'toast', tone: 'warn',
            title: e.intact ? 'Earth crossed the horizon intact' : 'Earth swallowed',
            sub: e.intact ? 'Near a big enough hole, tides at the horizon are gentle' : 'What remained fell through the horizon',
          });
          break;
        case 'probe-drop':
          this.emit({ type: 'toast', title: 'Probe away', sub: 'Watch its clock pulses slow down and redden' });
          break;
        case 'probe-lost':
          this.emit({ type: 'toast', title: 'Probe signal lost', sub: 'You never see it cross. Its light redshifted away.' });
          break;
        default:
          break;
      }
    }
    ev.length = 0;
  }

  // --- labels & telemetry ----------------------------------------------------
  project(v, out) {
    const c = this._tmp.copy(v).project(this.camera);
    out.visible = c.z < 1 && Math.abs(c.x) < 1.05 && Math.abs(c.y) < 1.05;
    out.x = ((c.x + 1) / 2) * this.viewW;
    out.y = ((1 - c.y) / 2) * this.viewH;
    return out;
  }
  updateLabels() {
    if (!this.labelSink) return;
    const L = this.labels;
    const keys = ['horizon', 'photon', 'disk', 'jets', 'lensing', 'tidal', 'probe'];
    for (const k of keys) L[k] = L[k] || { x: 0, y: 0, visible: false };
    if (this.world !== 'exterior' || this.director.name === 'enter') {
      for (const k of keys) L[k].visible = false;
      this.labelSink(L);
      return;
    }
    const rs = this.d.rsWorld;
    const cam = this.camera;
    this._up.setFromMatrixColumn(cam.matrixWorld, 1);
    this._right.setFromMatrixColumn(cam.matrixWorld, 0);
    const v = new THREE.Vector3();
    this.project(v.copy(this._up).multiplyScalar(2.75 * rs), L.horizon);
    this.project(v.copy(this._right).multiplyScalar(2.9 * rs).addScaledVector(this._up, -0.9 * rs), L.photon);
    const flat = v.set(-this._right.x, 0, -this._right.z);
    if (flat.lengthSq() < 1e-4) flat.set(1, 0, 0);
    flat.normalize().multiplyScalar(this.d.diskOut * 0.6 * rs);
    this.project(flat, L.disk);
    this.project(v.set(0, this.d.type.jetLength * 0.35 * rs, 0), L.jets);
    this.project(v.copy(this._right).multiplyScalar(-5.5 * rs).addScaledVector(this._up, 4 * rs), L.lensing);
    const E = this.sim.earth;
    if (E && E.alive) this.project(this._earthW, L.tidal);
    else L.tidal.visible = false;
    const P = this.sim.probe;
    if (P) this.project(v.set(P.dir[0], P.dir[1], P.dir[2]).multiplyScalar(P.r * rs), L.probe);
    else L.probe.visible = false;
    this.labelSink(L);
  }

  updateTelemetry(p, d, camR) {
    const T = this.telemetry;
    const sim = this.sim;
    T.fps = this.perf.fps;
    T.quality = (this.qualityMode === 'auto' ? 'Auto \u00B7 ' : '') + this.tier.label;
    T.res = Math.round((p.eht ? 0.22 : this.resScale) * 100);
    T.typeLabel = d.type.label;
    T.mass = p.mass;
    T.rsKm = d.rsMeters / 1000;
    T.spin = p.spin;
    T.horizonKm = (d.horizon * d.rsMeters) / 1000;
    T.isco = d.isco;
    T.photon = d.photon;
    T.camRs = this.world === 'exterior' ? camR : 0;
    T.camKm = T.camRs * T.rsKm;
    T.simTime = sim.time;
    T.tauCam = sim.tauCam;
    T.camRate = this.world === 'exterior' ? sim.camRate : 0;
    T.world = this.world;
    T.stage = this.interiorStage;
    T.sequence = this.director.name;
    T.caption = this.tour ? this.tour.caption : null;
    T.touring = !!this.tour;
    T.diskTempReal = d.diskTempReal;
    T.jetEff = d.jetBright;
    T.safeMode = !!this.safeMode;
    T.assets = this.registry.summary();
    T.discoveries = this.discoveries.size;
    T.cameraMode = this.cameraMode;
    T.recording = !!this.recorder;
    T.rtReal = d.tidalRadiusReal;
    T.rtScene = d.tidalRadiusScene;
    T.compressed = d.tidalCompressed;
    const E = sim.earth;
    const te = T.earth;
    te.present = !!E;
    te.active = !!(E && E.alive);
    if (E) {
      te.fate = E.fate;
      te.r = E.r;
      te.rKm = E.r * T.rsKm;
      te.vC = Math.min(0.999, circularSpeedC(E.r) * Math.sqrt(E.p / Math.max(E.r, 1e-3)));
      te.vKms = te.vC * 299792;
      te.stress = E.stress;
      te.stage = E.stage;
      te.stageName = STAGES[E.stage];
      te.tidalAcc = tidalAcceleration(p.mass, E.r);
      te.tidalG = te.tidalAcc / G_EARTH;
      te.mass = E.mass;
      te.tau = E.tau;
      te.rate = circularClockRate(E.r);
      te.unstable = E.unstable;
    }
    const P = sim.probe;
    const tp = T.probe;
    tp.active = !!P;
    if (P) {
      tp.r = P.r;
      tp.g = P.g;
      tp.tau = P.tau;
      tp.t = P.t;
      tp.pulses = P.pulses;
      tp.lost = P.lost;
    }
  }

  // --- input ------------------------------------------------------------------
  pickAt(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const px = x - rect.left, py = y - rect.top;
    const h = this.viewH;
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const E = this.sim.earth;
    if (E && E.alive && this.earthVis) {
      const s = this.project(this._earthW, { x: 0, y: 0, visible: false });
      const dist = this.camera.position.distanceTo(this._earthW);
      const rpx = (this.d.type.earthRadius / Math.max(dist, 1e-3) / tanHalf) * (h / 2);
      if (s.visible && Math.hypot(px - s.x, py - s.y) < Math.max(rpx * 1.6, 26)) return 'earth';
    }
    const c = this.project(O, { x: 0, y: 0, visible: false });
    const dist = this.camera.position.length();
    const shadow = 2.6 * this.d.rsWorld;
    if (dist < shadow * 1.05) return 'bh';
    const ang = Math.asin(Math.min(1, shadow / dist));
    const rpx = (Math.tan(ang) / tanHalf) * (h / 2);
    if (c.visible && Math.hypot(px - c.x, py - c.y) < rpx * 1.1) return 'bh';
    return 'space';
  }
  onTap(x, y) {
    if (this.world !== 'exterior' || this.director.name === 'enter' || this.director.name === 'return') return;
    const kind = this.pickAt(x, y);
    const T = this.taps;
    if (T.timer && T.kind === kind) T.count++;
    else {
      if (T.timer) {
        clearTimeout(T.timer);
        this.resolveTaps();
      }
      T.kind = kind;
      T.count = 1;
    }
    clearTimeout(T.timer);
    T.timer = setTimeout(() => this.resolveTaps(), 340);
  }
  resolveTaps() {
    const { kind, count } = this.taps;
    this.taps.timer = null;
    this.taps.count = 0;
    if (this.world !== 'exterior') return;
    if (kind === 'bh') {
      if (count >= 3) this.toggleEHT();
      else if (count === 2) this.swoop();
      else this.toggleIsolation();
    } else if (kind === 'earth') {
      if (count >= 2) this.swoop();
      else this.setCameraMode('earth');
    } else if (count >= 2) this.swoop();
    this.emit({ type: 'tap', kind, count });
  }
  onLongPress(x, y) {
    if (this.world !== 'exterior') return;
    const kind = this.pickAt(x, y);
    if (kind === 'earth') this.extremeTidal();
  }
  onZoomBeyondMax() {
    if (this.deepUnlocked || this.world !== 'exterior') return;
    this.deepUnlocked = true;
    this.unlock('deep', 'Deep Space camera', 'You pulled back past the lab limits.');
    this.setCameraMode('deep');
  }
  onZoomBelowMin() {
    const now = performance.now();
    if (now - (this._minToast || 0) < 7000 || this.world !== 'exterior') return;
    this._minToast = now;
    this.emit({ type: 'toast', title: 'Closest safe distance', sub: 'Use Enter Black Hole to cross the horizon.' });
  }
  onUserInput() {
    if (this.tour && !this.showcase) this.stopTour();
    if (this.director.name === 'swoop' || this.director.name === 'intro') this.director.cancel();
  }

  unlock(id, title, sub) {
    if (this.discoveries.has(id)) {
      this.emit({ type: 'toast', title, sub });
      return;
    }
    this.discoveries.add(id);
    try {
      localStorage.setItem('bhl.discoveries', JSON.stringify([...this.discoveries]));
    } catch (e) { /* ignore */ }
    this.audio.ping();
    this.emit({ type: 'discovery', title, sub, count: this.discoveries.size, total: DISCOVERY_TOTAL });
  }

  // --- actions used by the UI --------------------------------------------------
  setParams(patch) {
    const cur = this.store.get();
    this.store.set(sanitize(patch, cur));
  }
  tourOverride(patch) {
    this.setParams(patch);
  }
  setType(type) {
    if (!BH_TYPES[type] || type === this.params.bhType) return;
    this.setParams(typeDefaults(type));
    if (['blackhole', 'orbit', 'closeup', 'horizon', 'free'].includes(this.cameraMode)) this.pendingCamMode = this.cameraMode === 'free' ? 'blackhole' : this.cameraMode;
    this.emit({ type: 'toast', title: `${BH_TYPES[type].label} black hole`, sub: BH_TYPES[type].blurb });
  }
  setQuality(q) {
    this.setParams({ quality: q });
    this.qualityMode = q;
    this.upgrades = 0;
    this.setTier(this.resolveTier(q));
    this.resScale = this.tier.scale;
    this.resize();
  }
  applyCameraLimits() {
    if (!this.rig) return;
    const rs = this.d.rsWorld;
    if (this.cameraMode !== 'earth') this.rig.minDist = rs * 1.9;
    this.rig.maxDist = rs * (this.deepUnlocked ? 900 : 180);
  }
  setCameraMode(mode) {
    if (this.world !== 'exterior') return;
    if (mode === 'cinematic') {
      this.startTour({ loop: false });
      return;
    }
    if (this.tour) this.stopTour();
    if (this.director.name === 'swoop' || this.director.name === 'intro') this.director.cancel();
    const r = this.rig;
    const d = this.d;
    const rs = d.rsWorld;
    r.follow = null;
    r.autoRotate = 0;
    r.allowPan = false;
    this.cameraMode = mode;
    this.applyCameraLimits();
    switch (mode) {
      case 'free':
        r.allowPan = true;
        break;
      case 'orbit':
        r.setGoal({ target: O, dist: clamp(r.goal.dist, rs * 10, rs * 60) }, 2);
        r.autoRotate = 0.07;
        break;
      case 'closeup':
        r.setGoal({ target: O, dist: rs * 6.5, pitch: 0.1, fov: 50 }, 2);
        break;
      case 'blackhole':
        r.setGoal({ target: O, dist: rs * d.type.camDist, pitch: d.type.camPitch, fov: 50 }, 2);
        break;
      case 'earth': {
        if (!(this.sim.earth && this.sim.earth.alive)) this.addEarth();
        r.follow = () => this.earthWorld() || O;
        r.minDist = d.type.earthRadius * 2.4;
        const E = this.earthWorld();
        r.setGoal({ dist: d.type.earthRadius * 8, pitch: 0.12, yaw: E ? Math.atan2(E.x, E.z) + 0.25 : r.yaw, fov: 46 }, 2.2);
        break;
      }
      case 'horizon':
        r.setGoal({ target: O, dist: rs * 2.35, pitch: 0.035, fov: 55 }, 1.6);
        break;
      case 'deep':
        this.deepUnlocked = true;
        this.applyCameraLimits();
        r.setGoal({ target: O, dist: rs * 520, pitch: 0.3, fov: 35 }, 1.1);
        break;
      default:
        break;
    }
  }
  setCameraDistanceRs(v) {
    if (this.world !== 'exterior') return;
    const r = this.rig;
    if (this.cameraMode === 'earth') this.setCameraMode('blackhole');
    r.goal.dist = clamp(v * this.d.rsWorld, r.minDist, r.maxDist);
  }
  earthWorld() {
    const E = this.sim.earth;
    return E && E.alive ? this._earthW.clone() : null;
  }
  defaultPose() {
    const d = this.d;
    return { target: O.clone(), yaw: 0.7, pitch: d.type.camPitch, dist: d.rsWorld * d.type.camDist, fov: 50, roll: 0 };
  }
  saveReturnPose() {
    const pose = this.rig.pose();
    pose.dist = Math.max(pose.dist, this.d.rsWorld * 8);
    pose.fov = 50;
    pose.roll = 0;
    if (this.cameraMode === 'earth') pose.target = O.clone();
    this.returnPose = pose;
  }

  addEarth() {
    if (this.sim.earth && this.sim.earth.alive) return;
    this.sim.spawnEarth(this.params);
  }
  removeEarth() {
    this.sim.removeEarth();
    if (this.cameraMode === 'earth') this.setCameraMode('blackhole');
  }
  respawnEarth() {
    this.sim.removeEarth();
    this.sim.spawnEarth(this.params);
  }
  extremeTidal() {
    if (!(this.sim.earth && this.sim.earth.alive)) this.addEarth();
    this.setParams({ tidalGain: 3, earthDistance: Math.max(this.d.tidalRadiusScene * 0.92, this.d.isco * 1.4) });
    this.sim.extremeUntil = this.sim.realTime + 8;
    this.unlock('spaghetti', 'Spaghettification', 'Extreme tides: Earth stretched along the line to the hole.');
  }
  dropProbe() {
    if (this.world !== 'exterior') return;
    const rs = this.d.rsWorld;
    const c = this.camera.position;
    this.sim.dropProbe([c.x / rs, c.y / rs, c.z / rs]);
    this.probeVis.reset();
  }
  gwPulse() {
    this.sim.gwPulse();
    this.audio.chirp();
    this.emit({ type: 'toast', title: 'Gravitational wave', sub: 'Illustrative ripple, exaggerated about 10\u00B2\u2070\u00D7' });
  }
  toggleIsolation() {
    const on = !this.params.isolate;
    this.setParams({ isolate: on });
    if (on) this.unlock('isolation', 'Photon ring isolation', 'Only light that looped around the hole is shown.');
  }
  toggleEHT() {
    const on = !this.params.eht;
    this.setParams({ eht: on, isolate: false });
    if (on) {
      this.rig.setGoal({ target: O, pitch: 1.27, dist: this.d.rsWorld * 26 }, 1.6);
      this.unlock('eht', 'Telescope view', 'Blurred to EHT-like resolution, seen almost face-on like M87*.');
    }
  }
  swoop() {
    if (this.director.seq && this.director.name !== 'intro') return;
    this.director.play(new SwoopSequence(this));
    this.unlock('swoop', 'Cinematic swoop', 'Double-tap anywhere to fly around the hole.');
  }
  gargantua() {
    this.applyPreset('gargantua');
    this.unlock('gargantua', 'Gargantua', SECRET_GARGANTUA.note);
  }

  enter() {
    if (this.world !== 'exterior' || ['enter', 'return'].includes(this.director.name)) return;
    this.director.play(new EnterSequence(this));
  }
  skip() {
    if (this.director.name === 'enter') this.director.seq.skip();
  }
  goDeeper() {
    if (this.world !== 'interior' || this.director.seq) return;
    this.director.play(new StageSequence(this, 1));
  }
  rise() {
    if (this.world !== 'interior' || this.director.seq) return;
    this.director.play(new StageSequence(this, 0));
  }
  returnToObservation() {
    if (this.world !== 'interior' || this.director.name === 'return') return;
    this.director.play(new ReturnSequence(this));
  }
  setWorld(w) {
    this.world = w;
    const r = this.rig;
    if (w === 'interior') {
      r.follow = null;
      r.autoRotate = 0;
      r.lookMode = true;
      r.setImmediate({ yaw: 0, pitch: 0, fov: 58, roll: 0 });
      this.interiorStage = 0;
    } else {
      r.lookMode = false;
      this.interiorStage = 0;
      this.fx.interiorIntensity = 1;
      if (this.cameraMode === 'earth' || this.cameraMode === 'deep') this.cameraMode = 'blackhole';
      this.applyCameraLimits();
    }
    this.emit({ type: 'world', world: w });
  }

  startTour({ loop = false } = {}) {
    if (this.tour) this.stopTour();
    if (this.world !== 'exterior') {
      this.director.cancel();
      this.setWorld('exterior');
      this.rig.setImmediate(this.returnPose ?? this.defaultPose());
    }
    this.director.cancel();
    this.cameraMode = 'cinematic';
    this.rig.follow = null;
    this.rig.autoRotate = 0;
    this.tour = new Tour(this, { loop });
    this.director.tour = this.tour;
    this.tour.start();
  }
  stopTour() {
    const t = this.tour;
    if (!t) return;
    this.tour = null;
    this.director.tour = null;
    t.stop();
    this.rig.userEnabled = true;
    this.rig.damping = 4.5;
    this.cameraMode = 'orbit';
    if (this.world === 'exterior' && !this.director.seq) {
      this.rig.autoRotate = 0.07;
    }
  }
  setShowcase(on) {
    this.showcase = on;
    if (on) this.startTour({ loop: true });
    else this.stopTour();
  }

  applyPreset(id) {
    const preset = id === 'gargantua' ? SECRET_GARGANTUA : PRESETS.find((x) => x.id === id);
    if (!preset) return;
    if (this.tour) this.stopTour();
    this.setParams({ ...preset.params, isolate: false, eht: false });
    if (preset.earth) {
      if (this.sim.earth && this.sim.earth.alive) this.sim.earth.appear = Math.min(this.sim.earth.appear, 1);
      else this.addEarth();
    }
    if (this.world === 'exterior' && preset.camera) this.pendingCamMode = preset.camera;
    this.emit({ type: 'toast', title: preset.name, sub: preset.note });
  }
  resetAll() {
    if (this.tour) this.stopTour();
    const q = this.params.quality;
    this.store.set({ ...defaultParams(), quality: q });
    this.sim.removeEarth();
    this.sim.probe = null;
    this.sim.debris.clear();
    if (this.world !== 'exterior') {
      this.director.cancel();
      this.setWorld('exterior');
    }
    this.fx.timeWarp = 1;
    this.fx.enter = 0;
    this.fx.streak = 0;
    this.fx.ca = 0;
    this.fx.flash = 0;
    this.pendingCamMode = 'blackhole';
    this.emit({ type: 'toast', title: 'Laboratory reset' });
  }

  async setSound(on) {
    if (on) return this.audio.enable();
    this.audio.disable();
    return false;
  }

  capturePhoto() {
    this.captureRequested = true;
  }
  doCapture() {
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const s = Math.max(1, c.height / 900);
    const p = this.params;
    ctx.fillStyle = 'rgba(240, 228, 210, 0.85)';
    ctx.font = `600 ${Math.round(12 * s)}px system-ui, sans-serif`;
    ctx.fillText('BLACK HOLE LABORATORY', 22 * s, c.height - 40 * s);
    ctx.fillStyle = 'rgba(240, 228, 210, 0.55)';
    ctx.font = `${Math.round(11 * s)}px system-ui, sans-serif`;
    ctx.fillText(`${this.d.type.label} \u00B7 M = ${fmt(p.mass)} M\u2609 \u00B7 a* = ${p.spin.toFixed(3)} \u00B7 Physically inspired visualization`, 22 * s, c.height - 22 * s);
    c.toBlob((b) => b && download(b, `black-hole-lab-${Date.now()}.png`), 'image/png');
    this.emit({ type: 'toast', title: 'Photo saved' });
  }

  toggleRecording() {
    if (this.recorder) {
      this.recorder.stop();
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) {
      this.emit({ type: 'toast', title: 'Recording unavailable', sub: 'This browser cannot record the canvas. Use your system screen recorder.' });
      return;
    }
    const stream = this.canvas.captureStream(30);
    if (this.audio.enabled && this.audio.stream) this.audio.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m));
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
    } catch (e) {
      this.emit({ type: 'toast', title: 'Recording unavailable' });
      return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      this.recorder = null;
      const type = rec.mimeType || 'video/webm';
      download(new Blob(chunks, { type }), `black-hole-lab-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
      this.emit({ type: 'toast', title: 'Recording saved' });
    };
    rec.start(250);
    this.recorder = rec;
    this.emit({ type: 'toast', title: 'Recording', sub: 'Tap the record button again to stop' });
  }
}
