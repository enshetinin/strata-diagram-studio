// Measures 3D interaction smoothness on the 100-node / 150-edge fixture.
// Usage: node scripts/measure-perf.mjs [baseUrl] [--gpu]
// Prints the WebGL renderer actually used so results are never reported
// without their hardware context.
import { chromium } from '@playwright/test';

const baseUrl = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://localhost:4174';
const gpu = process.argv.includes('--gpu');
const args = gpu
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const started = Date.now();
await page.goto(`${baseUrl}/?stress=1&panels=closed`);
await page.waitForFunction(
  () => document.querySelector('.viewer3d')?.getAttribute('data-rendered-nodes') === '100',
  null,
  { timeout: 120_000 },
);
const loadMs = Date.now() - started;

const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info && gl ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
const quality = await page.evaluate(() => localStorage.getItem('strata:preferences') ?? 'default (medium)');

const box = await page.locator('.viewer3d canvas').boundingBox();
if (!box) throw new Error('canvas not found');
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    window.__frames.push(now - last);
    last = now;
    if (window.__frames.length < 100000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
// Continuous orbit drag for ~3 s (each move invalidates the demand-driven canvas).
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i < 180; i += 1) {
  const angle = (i / 180) * Math.PI * 2;
  await page.mouse.move(cx + Math.cos(angle) * 160, cy + Math.sin(angle) * 60);
}
await page.mouse.up();
const frames = await page.evaluate(() => window.__frames.slice(2));
await browser.close();

const sorted = [...frames].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const mean = frames.reduce((sum, value) => sum + value, 0) / frames.length;
console.log(
  JSON.stringify(
    {
      fixture: '100 nodes / 150 edges',
      viewport: '1440x900 CSS px, DPR 1',
      renderer,
      quality,
      loadToFirstSceneMs: loadMs,
      frames: frames.length,
      meanFrameMs: Number(mean.toFixed(1)),
      medianFrameMs: Number(pct(0.5).toFixed(1)),
      p95FrameMs: Number(pct(0.95).toFixed(1)),
      approxFps: Number((1000 / mean).toFixed(1)),
    },
    null,
    2,
  ),
);
