/**
 * Diagram colour tokens: the one place where diagram colours are written.
 * The 3D presets, the 2D editor, the SVG export and the PNG composition all
 * read from here, so every surface speaks the app's language: neutral greys,
 * true black in dark, blue/cyan only as a signal.
 *
 * Values mirror `src/styles/tokens.css` (WebGL and SVG cannot read CSS custom
 * properties); `diagramTokens.test.ts` keeps both files in step and checks
 * the WCAG 2.2 AA contrast pairs the proposal relies on.
 */
export type Scheme = 'light' | 'dark';

export interface DiagramPalette {
  scheme: Scheme;
  /** Canvas behind the diagram, same as the app's `--bg`. */
  canvas: string;
  /** Node bodies and top-level plates. */
  surface: string;
  /** Nested plates (depth 1 and 2). */
  surface2: string;
  surface3: string;
  /** Lit volume of 3D node bodies: lighter than the plates so blocks read as solids. */
  raised: string;
  /** Borders, primary connectors and labels. */
  ink: string;
  /** Kind labels and secondary relations. As text only on canvas, surface or surface2. */
  muted: string;
  /** Grid and decorative separators. Below 3:1: never the only boundary of a shape. */
  rule: string;
  /** Group and plate outlines: at least 3:1 on every surface (WCAG 1.4.11). */
  ruleStrong: string;
  /** Selection, active walkthrough step, focus ring. */
  signal: string;
  /** Second accent (cyan) for highlighted flows; never text on light. */
  signal2: string;
  success: string;
  error: string;
  /**
   * Domain accents, cold and restrained: blue, cyan, slate, grey, ink. Seen
   * only as a 3 px stripe or a thin node edge, never as a saturated fill.
   * Each reaches 3:1 against canvas and surface.
   */
  accents: readonly string[];
  /** Neutral light colours for the 3D rig (key and sky stay white; ground bounce follows the scheme). */
  light: { key: string; sky: string; ground: string; fill: string };
}

export const DIAGRAM_PALETTES: Record<Scheme, DiagramPalette> = {
  light: {
    scheme: 'light',
    canvas: '#FAFAFA',
    surface: '#FFFFFF',
    surface2: '#F0F0F1',
    surface3: '#E6E6E8',
    raised: '#FFFFFF',
    ink: '#0A0A0B',
    muted: '#6A6A70',
    rule: '#E6E6E8',
    ruleStrong: '#7A7A80',
    signal: '#1D5BD8',
    signal2: '#0E8FA8',
    success: '#17663A',
    error: '#B42318',
    accents: ['#1D5BD8', '#0B7A90', '#4E6A8E', '#6A6A70', '#0A0A0B'],
    light: { key: '#FFFFFF', sky: '#FFFFFF', ground: '#D4D4D8', fill: '#F0F0F1' },
  },
  dark: {
    scheme: 'dark',
    canvas: '#050506',
    surface: '#0D0D0F',
    surface2: '#17171A',
    surface3: '#1F1F23',
    raised: '#2A2A2F',
    ink: '#F2F2F3',
    muted: '#8D8D94',
    rule: '#1F1F23',
    ruleStrong: '#6A6A72',
    signal: '#7FA8FF',
    signal2: '#5FD4E6',
    success: '#6FD39A',
    error: '#FF8F85',
    accents: ['#7FA8FF', '#5FD4E6', '#9DB4D3', '#8D8D94', '#F2F2F3'],
    light: { key: '#FFFFFF', sky: '#B4B4BA', ground: '#050506', fill: '#5FD4E6' },
  },
};

/** Domain accent for a top-level group index; ungrouped elements (< 0) use `muted`. */
export function domainAccent(palette: DiagramPalette, index: number): string {
  if (index < 0) return palette.muted;
  return palette.accents[index % palette.accents.length] ?? palette.muted;
}

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** WCAG contrast ratio between two `#RRGGBB` colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
