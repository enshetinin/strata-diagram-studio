import { describe, expect, it } from 'vitest';
import { initialViewport, LEGIBLE_ZOOM } from './viewport';

const pane = { width: 800, height: 600 };

describe('initial 2D viewport', () => {
  it('centres a small diagram without zooming past 1', () => {
    const view = initialViewport([{ x: 0, y: 0, width: 200, height: 100 }], pane);
    expect(view?.zoom).toBe(1);
    // Content centre lands in the middle of the usable area.
    expect(view!.x + 100).toBeCloseTo(48 + (800 - 80) / 2);
  });

  it('keeps a legible zoom for wide diagrams and starts at their left edge', () => {
    const view = initialViewport([{ x: 100, y: 0, width: 4000, height: 300 }], pane);
    expect(view?.zoom).toBe(LEGIBLE_ZOOM);
    expect(view!.x + 100 * LEGIBLE_ZOOM).toBeCloseTo(48);
  });

  it('fits diagrams that fit at a legible zoom', () => {
    const view = initialViewport([{ x: 0, y: 0, width: 900, height: 400 }], pane);
    expect(view!.zoom).toBeGreaterThanOrEqual(LEGIBLE_ZOOM);
    expect(view!.zoom).toBeLessThan(1);
  });

  it('returns null for an empty diagram', () => {
    expect(initialViewport([], pane)).toBeNull();
  });
});
