import { describe, expect, it } from 'vitest';
import css from '../../styles/tokens.css?raw';
import { contrastRatio, DIAGRAM_PALETTES, type DiagramPalette, type Scheme } from './diagramTokens';

/** Custom properties declared in the first block that follows `selector`. */
function cssBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]));
}

const CSS: Record<Scheme, Record<string, string>> = {
  light: cssBlock(':root {'),
  dark: cssBlock(':root[data-theme="dark"]'),
};

describe.each(['light', 'dark'] as const)('%s palette', (scheme) => {
  const palette: DiagramPalette = DIAGRAM_PALETTES[scheme];
  const vars = CSS[scheme];
  const fromCss = (name: string): string | undefined => {
    const value = vars[name] ?? CSS.light[name];
    const alias = value?.match(/^var\(--([\w-]+)\)$/)?.[1];
    return alias ? fromCss(alias) : value?.toUpperCase();
  };

  it('mirrors the app tokens', () => {
    expect(palette.canvas).toBe(fromCss('bg'));
    expect(palette.surface).toBe(fromCss('block'));
    expect(palette.surface2).toBe(fromCss('surface'));
    expect(palette.ink).toBe(fromCss('fg'));
    expect(palette.muted).toBe(fromCss('muted'));
    expect(palette.rule).toBe(fromCss('edge-soft'));
    expect(palette.signal).toBe(fromCss('signal'));
    expect(palette.success).toBe(fromCss('success'));
    expect(palette.error).toBe(fromCss('error'));
  });

  const grounds = [palette.canvas, palette.surface, palette.surface2, palette.surface3];

  it('keeps text at 4.5:1 (WCAG 1.4.3)', () => {
    for (const ground of grounds) expect(contrastRatio(palette.ink, ground)).toBeGreaterThanOrEqual(4.5);
    for (const ground of [palette.canvas, palette.surface, palette.surface2]) {
      expect(contrastRatio(palette.muted, ground)).toBeGreaterThanOrEqual(4.5);
      // Selected labels are drawn in the signal colour.
      expect(contrastRatio(palette.signal, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps boundaries, accents and signals at 3:1 (WCAG 1.4.11)', () => {
    for (const ground of grounds) expect(contrastRatio(palette.ruleStrong, ground)).toBeGreaterThanOrEqual(3);
    for (const ground of [palette.canvas, palette.surface]) {
      expect(contrastRatio(palette.signal2, ground)).toBeGreaterThanOrEqual(3);
      for (const accent of palette.accents) expect(contrastRatio(accent, ground)).toBeGreaterThanOrEqual(3);
    }
  });
});

it('computes WCAG contrast', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#777777', '#777777')).toBe(1);
});
