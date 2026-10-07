/**
 * Shared-view session. A link opens its diagram read-only on top of whatever
 * this browser has saved: autosave pauses (the store refuses changes), and
 * the visitor either presents it, keeps a copy (replacing the saved diagram,
 * after a backup) or goes back to their own diagram.
 */
import { create } from 'zustand';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import { saveNow } from '../persistence/autosave';
import { backupSavedDocument, loadSaved } from '../persistence/storage';
import { defaultDocument } from '../templates';
import { decodeDocument, readShareHash, type ShareHash } from './shareLink';

export const READ_ONLY_MESSAGE = 'Vista compartida en solo lectura. Usa «Editar una copia» para cambiar el diagrama.';

/** `confirmCopy` holds the name of the saved diagram a copy would replace, while asking. */
export const useShareSession = create<{ active: boolean; confirmCopy: string | null }>()(() => ({ active: false, confirmCopy: null }));

function clearHash() {
  if (readShareHash(window.location.hash)) history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
}

function resetView() {
  const ui = useUiStore.getState();
  ui.clearSelection();
  ui.isolateGroup(null);
  ui.setNarrativeStep(null);
  ui.resetCamera();
}

/** Decodes a link and shows it read-only. Invalid links leave everything untouched. */
export async function openSharedLink(share: ShareHash): Promise<boolean> {
  const result = await decodeDocument(share.payload);
  const ui = useUiStore.getState();
  if (!result.ok) {
    ui.notify('error', `No se pudo abrir el enlace compartido: ${result.message}`);
    clearHash();
    return false;
  }
  const store = useDocumentStore.getState();
  // Read-only first, so autosave ignores the load below.
  store.setReadOnly(READ_ONLY_MESSAGE);
  store.load(result.document);
  useShareSession.setState({ active: true, confirmCopy: null });
  resetView();
  ui.setLeft(false);
  ui.setRight(false);
  ui.setMode('3d');
  if (share.present) ui.setPresenting(true);
  return true;
}

/** Back to the diagram saved in this browser (or the default template). */
export function leaveSharedView(): void {
  const store = useDocumentStore.getState();
  const saved = loadSaved();
  store.load(saved.status === 'ok' ? saved.document : defaultDocument());
  store.setReadOnly(null);
  useShareSession.setState({ active: false, confirmCopy: null });
  clearHash();
  resetView();
}

/** The shared diagram becomes this browser's diagram; the previous one is backed up first. */
export function keepSharedCopy(): void {
  const backupKey = backupSavedDocument();
  useDocumentStore.getState().setReadOnly(null);
  useShareSession.setState({ active: false, confirmCopy: null });
  clearHash();
  const saved = saveNow();
  const ui = useUiStore.getState();
  if (!saved) ui.notify('warning', 'La copia está abierta, pero no se pudo guardar en este navegador. Exporta el JSON para no perderla.');
  else ui.notify('success', backupKey ? `Copia guardada. El diagrama anterior quedó en localStorage «${backupKey}».` : 'Copia guardada en este navegador.');
}

/** Name of the diagram a copy would replace, if any. */
export function savedDocumentName(): string | null {
  const saved = loadSaved();
  return saved.status === 'ok' ? saved.document.name : null;
}
