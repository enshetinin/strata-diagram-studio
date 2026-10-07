import { useEffect } from 'react';
import { copySelection, cutSelection, lastCopiedText, pasteText } from '../state/actions';
import { useUiStore } from '../state/uiStore';
import { isTyping } from './useShortcuts';

/** Text the user selected on the page (labels, notices…) keeps the native copy. */
function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function ignored(event: Event): boolean {
  return useUiStore.getState().presenting || isTyping(event.target) || isTyping(document.activeElement);
}

/**
 * Copy, cut and paste of diagram elements through the system clipboard, so
 * fragments travel between tabs and documents as JSON text.
 *
 * Clipboard events are the primary path (synchronous access, no permission
 * prompt). Some browsers skip them when nothing on the page is selected, so
 * the shortcut handler checks right after the key press and falls back to the
 * async Clipboard API for copying and to the last in-app copy for pasting.
 */
export function useClipboard() {
  useEffect(() => {
    let handledByEvent = false;

    const onCopyOrCut = (event: ClipboardEvent) => {
      handledByEvent = true;
      if (ignored(event) || hasTextSelection() || useUiStore.getState().selection.length === 0) return;
      const text = event.type === 'cut' ? cutSelection() : copySelection();
      if (!text || !event.clipboardData) return;
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
    };

    const onPaste = (event: ClipboardEvent) => {
      handledByEvent = true;
      if (ignored(event)) return;
      const data = event.clipboardData;
      // An empty clipboard (e.g. a browser that never received our copy) falls back to the in-app copy.
      const text = data && data.types.length > 0 ? data.getData('text/plain') : lastCopiedText();
      if (text && pasteText(text)) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'c' && key !== 'x' && key !== 'v') return;
      if (ignored(event) || hasTextSelection()) return;
      handledByEvent = false;
      // Clipboard events run during the key's default action, before this task.
      setTimeout(() => {
        if (handledByEvent) return;
        if (key === 'v') {
          const text = lastCopiedText();
          if (text) pasteText(text);
          return;
        }
        if (useUiStore.getState().selection.length === 0) return;
        const text = key === 'x' ? cutSelection() : copySelection();
        if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
      }, 0);
    };

    document.addEventListener('copy', onCopyOrCut);
    document.addEventListener('cut', onCopyOrCut);
    document.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('copy', onCopyOrCut);
      document.removeEventListener('cut', onCopyOrCut);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
