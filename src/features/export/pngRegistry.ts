/**
 * The 3D view registers its exporter here while mounted, so toolbar code can
 * request a PNG without importing Three.js.
 */
export interface PngExportOptions {
  width: number;
  height: number;
  transparent: boolean;
  /**
   * Size of one layout unit relative to a 1080 px reference. Pixel-sized
   * strokes (fat connector lines) scale by it so a 4K render or a small
   * preview keeps the proportions of the 1080p image.
   */
  scale: number;
}

/** Renders the 3D scene off-screen and returns a 2D canvas holding the frame. */
export type PngExporter = (options: PngExportOptions) => Promise<HTMLCanvasElement>;

let current: PngExporter | null = null;
const waiters = new Set<(exporter: PngExporter) => void>();

export function registerPngExporter(exporter: PngExporter | null): void {
  current = exporter;
  if (exporter) {
    waiters.forEach((resolve) => resolve(exporter));
    waiters.clear();
  }
}

/** Resolves once a 3D view is mounted and ready (or rejects after `timeoutMs`). */
export function waitForPngExporter(timeoutMs = 15_000): Promise<PngExporter> {
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(done);
      reject(new Error('La vista 3D no está disponible para exportar (¿WebGL desactivado?).'));
    }, timeoutMs);
    const done = (exporter: PngExporter) => {
      clearTimeout(timer);
      resolve(exporter);
    };
    waiters.add(done);
  });
}
