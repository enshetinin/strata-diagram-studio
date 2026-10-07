import { serializeDocument } from '../../domain/parse';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import { downloadBlob, slugify } from './download';
import { PNG_FORMATS, type PngComposeOptions } from './pngOptions';
import { waitForPngExporter } from './pngRegistry';

const current = () => useDocumentStore.getState().doc;
const notify = (tone: 'success' | 'error', text: string) => useUiStore.getState().notify(tone, text);

export function exportJson(): void {
  const doc = current();
  downloadBlob(new Blob([serializeDocument(doc)], { type: 'application/json' }), `${slugify(doc.name)}.strata.json`);
  notify('success', 'JSON exportado.');
}

export async function exportSvgFile(): Promise<void> {
  try {
    const { exportSvg } = await import('./svg');
    const doc = current();
    downloadBlob(await exportSvg(doc), `${slugify(doc.name)}-2d.svg`);
    notify('success', 'SVG 2D exportado.');
  } catch (error) {
    notify('error', `No se pudo exportar el SVG: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Composed PNG (3D frame plus optional title and legend). Switches to 3D when
 * needed, since the exporter lives in the 3D view. `size` overrides the
 * format's pixels for previews.
 */
export async function renderPng(
  options: PngComposeOptions,
  size?: { width: number; height: number },
): Promise<HTMLCanvasElement> {
  const ui = useUiStore.getState();
  if (ui.mode !== '3d') ui.setMode('3d');
  const [exporter, { composePng }] = await Promise.all([waitForPngExporter(), import('./pngComposition')]);
  return composePng(current(), options, exporter, size ?? PNG_FORMATS[options.format]);
}

export async function exportPngFile(options: PngComposeOptions): Promise<boolean> {
  const format = PNG_FORMATS[options.format];
  try {
    const { canvasToPng } = await import('./pngComposition');
    const blob = await canvasToPng(await renderPng(options));
    downloadBlob(
      blob,
      `${slugify(current().name)}-3d-${options.format}${options.transparent ? '-transparente' : ''}.png`,
    );
    notify(
      'success',
      `PNG ${format.width}×${format.height} exportado${options.transparent ? ' con fondo transparente' : ''}.`,
    );
    return true;
  } catch (error) {
    notify('error', `No se pudo exportar el PNG: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
