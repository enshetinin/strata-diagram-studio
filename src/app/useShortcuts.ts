import { useEffect } from 'react';
import { moveElements, type Move } from '../domain/commands';
import { deleteSelection, duplicateSelection, groupSelection, ungroupSelection } from '../state/actions';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';
import { saveNow } from '../features/persistence/autosave';

/** Never intercept keys while the user types or interacts with a dialog. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('dialog[open]')) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'range'].includes(type);
  }
  return false;
}

function nudge(dx: number, dy: number) {
  const { selection } = useUiStore.getState();
  const doc = useDocumentStore.getState().doc;
  const moves: Move[] = selection.flatMap((ref): Move[] => {
    if (ref.type === 'edge') return [];
    const rect = ref.type === 'node' ? doc.layout.nodes[ref.id] : doc.layout.groups[ref.id];
    return rect ? [{ type: ref.type, id: ref.id, x: rect.x + dx, y: rect.y + dy }] : [];
  });
  if (moves.length === 0) return;
  const result = useDocumentStore.getState().execute('Mover con teclado', (d) => moveElements(d, moves));
  if (!result.ok) useUiStore.getState().notify('error', result.error);
}

export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const ui = useUiStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (ui.presenting) return; // the presentation overlay owns arrows / Escape

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useDocumentStore.getState().undo();
      } else if (mod && ((key === 'z' && event.shiftKey) || key === 'y')) {
        event.preventDefault();
        useDocumentStore.getState().redo();
      } else if (mod && key === 's') {
        event.preventDefault();
        if (saveNow()) ui.notify('success', 'Guardado en este navegador.');
      } else if (mod && key === 'd') {
        event.preventDefault();
        duplicateSelection();
      } else if (mod && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (ui.selection.length === 0) return;
        event.preventDefault();
        deleteSelection();
      } else if (event.key === 'Escape') {
        ui.clearSelection();
      } else if (!mod && key === 'f') {
        const primary = ui.selection[ui.selection.length - 1];
        if (primary && primary.type !== 'edge') ui.focus(primary);
      } else if (!mod && ui.mode === '2d' && event.key.startsWith('Arrow') && ui.selection.length > 0 && !(event.target instanceof HTMLElement && event.target.closest('[role="tablist"],[role="menu"],[role="radiogroup"]'))) {
        event.preventDefault();
        const step = event.shiftKey ? 32 : 8;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        nudge(dx, dy);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
