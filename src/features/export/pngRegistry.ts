/**
 * The 3D view registers its exporter here while mounted, so toolbar code can
 * request a PNG without importing Three.js.
 */
export interface PngExportOptions {
  width: number;
  height: number;
  transparent: boolean;
}

export type PngExporter = (options: PngExportOptions) => Promise<Blob>;

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
