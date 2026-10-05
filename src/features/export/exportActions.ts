import { serializeDocument } from '../../domain/parse';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import { downloadBlob, slugify } from './download';
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

/** PNG of the 3D scene at 1920×1080; switches to 3D if needed. */
export async function exportPngFile(transparent: boolean): Promise<void> {
  const ui = useUiStore.getState();
  if (ui.mode !== '3d') ui.setMode('3d');
  try {
    const exporter = await waitForPngExporter();
    const blob = await exporter({ width: 1920, height: 1080, transparent });
    downloadBlob(blob, `${slugify(current().name)}-3d${transparent ? '-transparente' : ''}.png`);
    notify('success', `PNG 1920×1080 exportado${transparent ? ' con fondo transparente' : ''}.`);
  } catch (error) {
    notify('error', `No se pudo exportar el PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
}
