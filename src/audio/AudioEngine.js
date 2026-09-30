// Fully synthesized ambience (Web Audio, no files). Off by default.
// The drone is "gravitationally redshifted": its pitch and brightness follow
// the camera's clock rate, so the sound sinks as you approach the horizon.
// Local audio files can be layered later through `playBuffer()`.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._acc = 0;
    this.lastCrackle = 0;
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Web Audio unavailable');
    const ctx = (this.ctx = new AC());
    const master = (this.master = ctx.createGain());
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    this.streamDest = ctx.createMediaStreamDestination();
    comp.connect(this.streamDest);

    // Drone
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 520;
    this.lp.Q.value = 0.6;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.2;
    this.lp.connect(this.droneGain).connect(master);
    this.oscs = [
      [55, 'sine', 0.5], [82.41, 'sine', 0.28], [27.5, 'triangle', 0.35], [110.3, 'sine', 0.08],
    ].map(([f, type, g]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(this.lp);
      o.start();
      return { o, base: f };
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(this.lp.frequency);
    lfo.start();

    // Disk "roar": brown noise through a wandering band-pass
    this.noiseBuf = this.makeNoise(2.5);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    this.bp = ctx.createBiquadFilter();
    this.bp.type = 'bandpass';
    this.bp.frequency.value = 280;
    this.bp.Q.value = 0.8;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.03;
    src.connect(this.bp).connect(this.noiseGain).connect(master);
    src.start();

    // Interior pad
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 1100;
    padLp.connect(this.padGain).connect(master);
    this.pad = [110, 130.81, 164.81, 207.65].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      o.connect(g).connect(padLp);
      o.start();
      return o;
    });
    // Shimmer for the singularity
    this.shimmer = ctx.createOscillator();
    this.shimmer.frequency.value = 1318.5;
    this.shimGain = ctx.createGain();
    this.shimGain.gain.value = 0;
    // Tremolo modulates a unity stage, so silence stays silent.
    const shimAmp = ctx.createGain();
    shimAmp.gain.value = 0.65;
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tremG = ctx.createGain();
    tremG.gain.value = 0.35;
    trem.connect(tremG).connect(shimAmp.gain);
    this.shimmer.connect(shimAmp).connect(this.shimGain).connect(master);
    this.shimmer.start();
    trem.start();
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  async enable() {
    try {
      if (!this.ctx) this.build();
      await this.ctx.resume();
      this.enabled = true;
      this.ramp(this.master.gain, 0.55, 0.8);
      return true;
    } catch (e) {
      console.warn('[BHL] audio unavailable', e);
      return false;
    }
  }
  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    this.ramp(this.master.gain, 0, 0.4);
  }
  ramp(param, v, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + time);
  }
  set(param, v, tc = 0.25) {
    param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  /** Called every frame with a small state snapshot; throttled internally. */
  update(dt, s) {
    if (!this.enabled || !this.ctx) return;
    this._acc += dt;
    if (this._acc < 0.1) return;
    this._acc = 0;
    const rate = Math.max(0.05, s.clockRate);
    const inside = s.world === 'interior';
    for (const { o, base } of this.oscs) this.set(o.frequency, base * (0.3 + 0.7 * rate), 0.4);
    this.set(this.lp.frequency, 160 + 700 * rate * rate, 0.4);
    this.set(this.droneGain.gain, inside ? 0.05 : 0.2, 0.6);
    if (!this.entering) {
      this.set(this.noiseGain.gain, inside ? 0.0 : 0.012 + 0.05 * s.diskEnergy, 0.5);
      this.set(this.bp.frequency, 180 + 380 * s.diskEnergy + 120 * Math.sin(performance.now() / 3100), 0.8);
    }
    this.set(this.padGain.gain, inside ? 0.11 * (1 - s.stage * 0.5) : 0, 1.2);
    this.set(this.shimGain.gain, inside ? 0.012 * s.stage : 0, 1.0);
  }

  enterStart() {
    if (!this.enabled) return;
    this.entering = true;
    const t = this.ctx.currentTime;
    this.bp.frequency.cancelScheduledValues(t);
    this.bp.frequency.setValueAtTime(200, t);
    this.bp.frequency.exponentialRampToValueAtTime(2600, t + 7.6);
    this.noiseGain.gain.cancelScheduledValues(t);
    this.noiseGain.gain.setValueAtTime(0.04, t);
    this.noiseGain.gain.linearRampToValueAtTime(0.22, t + 7.6);
  }
  crossHorizon() {
    this.entering = false;
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.noiseGain.gain.cancelScheduledValues(t);
    this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, t);
    this.noiseGain.gain.linearRampToValueAtTime(0.0001, t + 0.12);
    this.boom(44, 22, 3.2, 0.5);
  }
  boom(f0, f1, dur, gain) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  stage(target) {
    if (target > 0.5) this.boom(60, 30, 2.5, 0.25);
  }
  returnOut() {
    this.entering = false;
    if (!this.enabled) return;
    this.whoosh(0.9, 3000, 200, 0.12);
  }
  whoosh(dur, f0, f1, gain) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  /** Gravitational-wave "chirp": inspiral sweep then ringdown. */
  chirp() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(35, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(250, t + 1.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 1.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.95);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 2);
  }
  crackle() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastCrackle < 400) return;
    this.lastCrackle = now;
    this.whoosh(0.35, 900, 300, 0.05);
  }
  ping() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 987.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
  }
  /** Hook for future local audio assets (decoded AudioBuffer). */
  playBuffer(buffer, gain = 0.3) {
    if (!this.enabled || !buffer) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.master);
    s.start();
  }
  get stream() {
    return this.streamDest?.stream ?? null;
  }
  dispose() {
    this.ctx?.close();
  }
}
