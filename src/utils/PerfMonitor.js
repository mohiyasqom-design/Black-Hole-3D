// Rolling FPS measurement. Emits one sample per second for adaptive quality.
export class PerfMonitor {
  constructor() {
    this.frames = 0;
    this.acc = 0;
    this.fps = 60;
    this.sampleReady = false;
  }
  tick(dt) {
    this.sampleReady = false;
    this.frames++;
    this.acc += dt;
    if (this.acc >= 1) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
      this.sampleReady = true;
    }
  }
}
