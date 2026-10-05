import { create } from 'zustand';
import { useDocumentStore } from '../../state/documentStore';
import { saveDocument } from './storage';

export type SaveState = 'idle' | 'pending' | 'saved' | 'error';

interface SaveStatus {
  state: SaveState;
  savedAt: string | null;
  message: string | null;
}

export const useSaveStatus = create<SaveStatus>()(() => ({ state: 'idle', savedAt: null, message: null }));

const DEBOUNCE_MS = 700;
let timer: ReturnType<typeof setTimeout> | null = null;

export function saveNow(): boolean {
  if (timer) clearTimeout(timer);
  timer = null;
  const result = saveDocument(useDocumentStore.getState().doc);
  if (result.ok) useSaveStatus.setState({ state: 'saved', savedAt: result.savedAt, message: null });
  else useSaveStatus.setState({ state: 'error', message: result.message });
  return result.ok;
}

/** Starts debounced autosave; returns the unsubscribe function. */
export function startAutosave(): () => void {
  const unsubscribe = useDocumentStore.subscribe((state, previous) => {
    if (state.doc === previous.doc) return;
    useSaveStatus.setState({ state: 'pending' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, DEBOUNCE_MS);
  });
  const flush = () => {
    if (timer) saveNow();
  };
  window.addEventListener('pagehide', flush);
  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', flush);
  };
}
