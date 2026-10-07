/**
 * Opening viewport for the 2D editor. Fitting a large diagram into a narrow
 * canvas makes every label unreadable, so the zoom never drops below a
 * legible floor: what does not fit is entered from its start (top-left,
 * where flows begin) and the rest is a pan or "Encuadrar todo" away.
 */
import { unionRects } from '../../domain/geometry';
import type { Rect } from '../../domain/types';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Below this, node titles fall under ~10 px. */
export const LEGIBLE_ZOOM = 0.7;
const MAX_ZOOM = 1;
/** Room kept for the floating toolbar (top) and controls (left). */
const PAD = { left: 48, top: 80, right: 32, bottom: 32 };

export function initialViewport(rects: Rect[], pane: { width: number; height: number }): Viewport | null {
  const bounds = unionRects(rects);
  if (!bounds || pane.width <= 0 || pane.height <= 0) return null;
  const usable = { width: Math.max(1, pane.width - PAD.left - PAD.right), height: Math.max(1, pane.height - PAD.top - PAD.bottom) };
  const fit = Math.min(usable.width / bounds.width, usable.height / bounds.height);
  const zoom = Math.min(MAX_ZOOM, Math.max(LEGIBLE_ZOOM, fit));
  const width = bounds.width * zoom;
  const height = bounds.height * zoom;
  // Centre each axis that fits; otherwise start from the content's edge.
  const x = width <= usable.width ? PAD.left + (usable.width - width) / 2 - bounds.x * zoom : PAD.left - bounds.x * zoom;
  const y = height <= usable.height ? PAD.top + (usable.height - height) / 2 - bounds.y * zoom : PAD.top - bounds.y * zoom;
  return { x, y, zoom };
}
