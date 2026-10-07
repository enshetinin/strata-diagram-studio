/**
 * The 2D canvas registers a reader for the pointer position (in canvas
 * coordinates) while mounted, so a paste can land under the cursor without
 * the clipboard code depending on React Flow.
 */
import type { Point } from '../../domain/geometry';

type AnchorReader = () => Point | null;

let reader: AnchorReader | null = null;

export function registerPasteAnchor(next: AnchorReader | null): void {
  reader = next;
}

/** Canvas point under the pointer, or `null` when the pointer is not over the 2D canvas. */
export function pasteAnchor(): Point | null {
  return reader?.() ?? null;
}
