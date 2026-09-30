import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const install = spawnSync('npm', ['install', '--no-save', '--no-package-lock', 'playwright@1.55.0'], { stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status || 1);
const { chromium } = await import('playwright');

const duration = Math.max(5, Number(process.env.DURATION || 30));
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--disable-gpu-sandbox',
  ],
});

const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__BHL__);

await page.evaluate(() => {
  const engine = window.__BHL__;
  engine.setQuality('high');
  engine.setShowcase(true);
});

await page.waitForTimeout(4000);

const video = 'artifacts/showcase.webm';
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'x11grab',
  '-video_size', '1920x1080',
  '-framerate', '30',
  '-i', ':99',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  'artifacts/black-hole-showcase-1080p.mp4',
], { stdio: 'inherit' });

// This workflow needs a real X display. If one is not available, fail clearly.
ffmpeg.on('error', (err) => {
  console.error(err);
  process.exitCode = 1;
});

await page.evaluate(() => document.body.dataset.recordReady = '1');
await new Promise(r => setTimeout(r, duration * 1000));
ffmpeg.kill('SIGINT');

await new Promise(resolve => {
  ffmpeg.once('close', resolve);
});

await browser.close();
