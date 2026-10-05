import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// QA_GPU=metal uses the real GPU on macOS (ANGLE/Metal); default is software WebGL.
const gpuArgs = process.env.QA_GPU === 'metal' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : undefined;

/** Visual QA: writes reference screenshots to docs/qa (run: pnpm qa:screens). */
export default defineConfig({
  ...base,
  testDir: 'tests/qa',
  timeout: 120_000,
  use: { ...base.use, ...(gpuArgs ? { launchOptions: { args: gpuArgs } } : {}) },
  projects: undefined,
});
