import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const duration = Math.max(5, Number(process.env.DURATION || 30));
const display = process.env.DISPLAY || ':99';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-webgl2-compute-context',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-gpu-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920,1080',
    '--start-maximized',
  ],
});

const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__BHL__);

const rendererInfo = await page.evaluate(() => {
  const gl = document.querySelector('canvas')?.getContext('webgl2') || document.querySelector('canvas')?.getContext('webgl');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown',
  };
});
console.log('[BHL] WebGL renderer:', rendererInfo);

await page.evaluate(() => {
  const engine = window.__BHL__;
  // Start from the user's High preset, then use a recording-safe render profile.
  // The output is still 1920x1080, but the internal render workload is reduced
  // enough for a CPU/virtual-GPU CI runner to animate smoothly.
  engine.setQuality('high');
  engine.setTier({
    id: 'record',
    label: 'High · Recording',
    pr: 1,
    scale: 0.64,
    minScale: 0.64,
    steps: 112,
    stepK: 0.10,
    starQ: 1,
    jets: 3600,
    dust: 2800,
    debris: 3200,
    earthSeg: [80, 56],
  });
  engine.resScale = 0.64;
  engine.resize();
  engine.setShowcase(true);
});

await page.waitForTimeout(5000);

const fps = await page.evaluate(async () => {
  let frames = 0;
  let last = performance.now();
  const start = last;
  return await new Promise((resolve) => {
    const tick = (now) => {
      frames++;
      if (now - start >= 3000) {
        resolve(frames * 1000 / (now - start));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});
console.log('[BHL] Measured animation FPS:', fps.toFixed(1));

if (fps < 15) {
  console.warn('[BHL] FPS is still low; switching to performance-safe profile.');
  await page.evaluate(() => {
    const engine = window.__BHL__;
    engine.setTier({
      id: 'record-safe',
      label: 'Recording Safe',
      pr: 1,
      scale: 0.48,
      minScale: 0.48,
      steps: 72,
      stepK: 0.14,
      starQ: 0,
      jets: 1600,
      dust: 1400,
      debris: 1800,
      earthSeg: [48, 32],
    });
    engine.resScale = 0.48;
    engine.resize();
  });
  await page.waitForTimeout(2500);
}

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'x11grab',
  '-video_size', '1920x1080',
  '-framerate', '30',
  '-i', display,
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  'artifacts/black-hole-showcase-1080p.mp4',
], { stdio: 'inherit' });

ffmpeg.on('error', (err) => {
  console.error('[BHL] FFmpeg error:', err);
  process.exitCode = 1;
});

await new Promise(r => setTimeout(r, duration * 1000));
ffmpeg.kill('SIGINT');

await new Promise(resolve => ffmpeg.once('close', resolve));
await browser.close();
