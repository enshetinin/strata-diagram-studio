/**
 * Declarative style presets. A theme only describes materials, geometry
 * treatment, light, camera and connectors; it never touches the graph.
 * Every colour comes from the diagram palette, so the four presets differ in
 * material and light, not in colour language.
 */
import type { Presentation, RelationKind, StyleId } from '../../domain/types';
import { DIAGRAM_PALETTES, type DiagramPalette } from '../theme/diagramTokens';

export type PlatformTreatment = 'slab' | 'glass' | 'outline' | 'plate' | 'deck';
export type NodeFinish = 'matte' | 'satin' | 'solid' | 'wire' | 'ink';

export interface ThemeTokens {
  id: StyleId;
  name: string;
  tagline: string;
  /** Colour source shared with the 2D editor, the SVG export and the PNG overlay. */
  palette: DiagramPalette;
  dark: boolean;
  background: string;
  /** Ground treatment beneath the scene. */
  ground: { kind: 'shadow' | 'grid' | 'dots' | 'none'; color: string; opacity: number };
  camera: { projection: 'orthographic' | 'perspective'; azimuthDeg: number; elevationDeg: number; fov: number };
  light: {
    /** Tone-mapping exposure: light styles lift whites back to white. */
    exposure: number;
    ambient: { color: string; intensity: number };
    hemi?: { sky: string; ground: string; intensity: number };
    key: { color: string; intensity: number; position: [number, number, number] };
    fill?: { color: string; intensity: number; position: [number, number, number] };
    shadows: boolean;
  };
  platform: {
    treatment: PlatformTreatment;
    /** Surface colour per nesting depth (cycled). */
    colors: string[];
    opacity: number;
    edge: string;
    edgeOpacity: number;
    title: string;
    /** Draw width annotations (Blueprint). */
    dimensions: boolean;
  };
  node: {
    finish: NodeFinish;
    body: string;
    /** Accent colour for the ink finish; other finishes use the domain accent. */
    cap: string;
    edges: boolean;
    edgeColor: string;
    /** Hairline outline opacity (architectural-model look). */
    edgeOpacity: number;
    roughness: number;
    metalness: number;
    heightScale: number;
    plateText: string;
    /** Small ink details on node models: vents, screens, status marks. */
    detail: string;
    /** Opacity of the translucent glass layers on node models. */
    glassOpacity: number;
  };
  connector: {
    route: 'orthogonal' | 'arc';
    render: 'tube' | 'line';
    radius: number;
    colors: Partial<Record<RelationKind, string>> & { default: string };
    arrow: 'cone' | 'chevron';
    arrowColor: string | null;
    opacity: number;
  };
  label: { color: string; outline: string; muted: string; weight: 500 | 700; size: number };
  /** Limited per-preset palette for domains (top-level groups). */
  accents: readonly string[];
  selection: string;
  particles: string;
  /** UI hint for the legend / overlays drawn over the canvas. */
  overlay: 'light' | 'dark';
}

const LIGHT = DIAGRAM_PALETTES.light;
const DARK = DIAGRAM_PALETTES.dark;

/** Relations whose type is secondary to the flow: drawn in `muted`, the rest in `ink`. */
function relationColors(palette: DiagramPalette): ThemeTokens['connector']['colors'] {
  return { default: palette.ink, telemetry: palette.muted, dependency: palette.muted, backup: palette.muted };
}

const porcelain: ThemeTokens = {
  id: 'porcelain',
  name: 'Porcelain',
  tagline: 'Placas blancas, sombra suave y tubos finos sobre gris neutro',
  palette: LIGHT,
  dark: false,
  background: LIGHT.canvas,
  ground: { kind: 'shadow', color: LIGHT.ink, opacity: 0.1 },
  camera: { projection: 'orthographic', azimuthDeg: 34, elevationDeg: 30, fov: 30 },
  light: {
    exposure: 1.3,
    ambient: { color: LIGHT.light.key, intensity: 0.5 },
    hemi: { sky: LIGHT.light.sky, ground: LIGHT.light.ground, intensity: 0.7 },
    key: { color: LIGHT.light.key, intensity: 1.7, position: [-4, 12, 7] },
    fill: { color: LIGHT.light.fill, intensity: 0.45, position: [8, 5, -2] },
    shadows: true,
  },
  platform: {
    treatment: 'plate',
    colors: [LIGHT.surface, LIGHT.surface2, LIGHT.surface3],
    opacity: 1,
    edge: LIGHT.ruleStrong,
    edgeOpacity: 1,
    title: LIGHT.ink,
    dimensions: false,
  },
  node: {
    finish: 'matte',
    body: LIGHT.raised,
    cap: LIGHT.muted,
    edges: true,
    edgeColor: LIGHT.ink,
    edgeOpacity: 0.55,
    roughness: 0.8,
    metalness: 0,
    heightScale: 1,
    plateText: LIGHT.ink,
    detail: LIGHT.ink,
    glassOpacity: 0.7,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.018,
    colors: relationColors(LIGHT),
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: LIGHT.ink, outline: LIGHT.canvas, muted: LIGHT.muted, weight: 500, size: 0.15 },
  accents: LIGHT.accents,
  selection: LIGHT.signal,
  particles: LIGHT.signal,
  overlay: 'light',
};

const editorial: ThemeTokens = {
  id: 'editorial',
  name: 'Editorial',
  tagline: 'Solo tinta, contornos de 1 px y sin sombra; pensado para exportar e imprimir',
  palette: LIGHT,
  dark: false,
  background: LIGHT.surface,
  ground: { kind: 'none', color: LIGHT.ink, opacity: 0 },
  camera: { projection: 'orthographic', azimuthDeg: 30, elevationDeg: 32, fov: 30 },
  light: {
    exposure: 1.7,
    ambient: { color: LIGHT.light.key, intensity: 0.55 },
    hemi: { sky: LIGHT.light.sky, ground: LIGHT.light.ground, intensity: 0.8 },
    key: { color: LIGHT.light.key, intensity: 1.8, position: [-3, 12, 8] },
    fill: { color: LIGHT.light.key, intensity: 0.3, position: [8, 4, -2] },
    shadows: false,
  },
  platform: {
    treatment: 'plate',
    colors: [LIGHT.surface, LIGHT.surface2, LIGHT.surface3],
    opacity: 1,
    edge: LIGHT.ink,
    edgeOpacity: 1,
    title: LIGHT.ink,
    dimensions: false,
  },
  node: {
    finish: 'ink',
    body: LIGHT.surface,
    cap: LIGHT.ink,
    edges: true,
    edgeColor: LIGHT.ink,
    edgeOpacity: 1,
    roughness: 0.9,
    metalness: 0,
    heightScale: 1,
    plateText: LIGHT.surface,
    detail: LIGHT.ink,
    glassOpacity: 0.3,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.013,
    colors: relationColors(LIGHT),
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: LIGHT.ink, outline: LIGHT.surface, muted: LIGHT.muted, weight: 700, size: 0.15 },
  // Domains are told apart by their titles, not by colour.
  accents: [LIGHT.ink],
  selection: LIGHT.signal,
  particles: LIGHT.signal,
  overlay: 'light',
};

const midnight: ThemeTokens = {
  id: 'midnight',
  name: 'Midnight',
  tagline: 'Negro puro, volumen satinado, luz lateral y señal cian',
  palette: DARK,
  dark: true,
  background: DARK.canvas,
  ground: { kind: 'dots', color: DARK.rule, opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 34, elevationDeg: 30, fov: 30 },
  light: {
    exposure: 1.0,
    ambient: { color: DARK.light.sky, intensity: 0.4 },
    hemi: { sky: DARK.light.sky, ground: DARK.light.ground, intensity: 0.25 },
    key: { color: DARK.light.key, intensity: 2.3, position: [-6, 9, 8] },
    fill: { color: DARK.light.fill, intensity: 0.4, position: [9, 3, -2] },
    shadows: true,
  },
  platform: {
    treatment: 'deck',
    colors: [DARK.surface, DARK.surface2, DARK.surface3],
    opacity: 1,
    edge: DARK.ruleStrong,
    edgeOpacity: 1,
    title: DARK.ink,
    dimensions: false,
  },
  node: {
    finish: 'satin',
    body: DARK.raised,
    cap: DARK.muted,
    edges: true,
    edgeColor: DARK.muted,
    edgeOpacity: 0.7,
    roughness: 0.5,
    metalness: 0.15,
    heightScale: 1.05,
    plateText: DARK.ink,
    detail: DARK.ink,
    glassOpacity: 0.55,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.016,
    colors: relationColors(DARK),
    arrow: 'chevron',
    arrowColor: null,
    opacity: 0.95,
  },
  label: { color: DARK.ink, outline: DARK.canvas, muted: DARK.muted, weight: 500, size: 0.15 },
  accents: DARK.accents,
  selection: DARK.signal2,
  particles: DARK.signal2,
  overlay: 'dark',
};

const blueprint: ThemeTokens = {
  id: 'blueprint',
  name: 'Blueprint',
  tagline: 'Wireframe, cotas y rejilla sobre negro; el azul vive en las líneas',
  palette: DARK,
  dark: true,
  background: DARK.canvas,
  ground: { kind: 'grid', color: DARK.rule, opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 36, elevationDeg: 32, fov: 30 },
  light: {
    exposure: 1.0,
    ambient: { color: DARK.light.key, intensity: 1.0 },
    key: { color: DARK.light.key, intensity: 0.6, position: [4, 10, 6] },
    shadows: false,
  },
  platform: {
    treatment: 'outline',
    colors: [DARK.surface, DARK.surface2, DARK.surface3],
    opacity: 0.55,
    edge: DARK.signal,
    edgeOpacity: 1,
    title: DARK.ink,
    dimensions: true,
  },
  node: {
    finish: 'wire',
    body: DARK.surface2,
    cap: DARK.surface3,
    edges: true,
    edgeColor: DARK.signal,
    edgeOpacity: 1,
    roughness: 1,
    metalness: 0,
    heightScale: 0.9,
    plateText: DARK.ink,
    detail: DARK.signal,
    glassOpacity: 0.35,
  },
  connector: {
    route: 'orthogonal',
    render: 'line',
    radius: 0.012,
    colors: relationColors(DARK),
    arrow: 'chevron',
    arrowColor: DARK.ink,
    opacity: 1,
  },
  label: { color: DARK.ink, outline: DARK.canvas, muted: DARK.muted, weight: 500, size: 0.14 },
  accents: DARK.accents,
  selection: DARK.signal2,
  particles: DARK.signal2,
  overlay: 'dark',
};

export const THEMES: Record<StyleId, ThemeTokens> = { porcelain, editorial, midnight, blueprint };

/**
 * The preset with the document's appearance options applied: arc connectors
 * and translucent glass layers are options on any preset, not presets.
 */
export function resolveTheme(presentation: Presentation): ThemeTokens {
  const preset = THEMES[presentation.styleId];
  const { connectorRoute, translucentLayers } = presentation.appearance;
  if (connectorRoute === preset.connector.route && !translucentLayers) return preset;
  const { palette } = preset;
  return {
    ...preset,
    connector: { ...preset.connector, route: connectorRoute },
    platform: translucentLayers
      ? {
          ...preset.platform,
          treatment: 'glass',
          colors: palette.accents.slice(0, 3),
          opacity: preset.dark ? 0.13 : 0.16,
          edge: palette.ruleStrong,
          edgeOpacity: 1,
        }
      : preset.platform,
  };
}

export function connectorColor(theme: ThemeTokens, relation: RelationKind): string {
  return theme.connector.colors[relation] ?? theme.connector.colors.default;
}

export function accentColor(theme: ThemeTokens, accent: number): string {
  if (accent < 0) return theme.node.cap;
  return theme.accents[accent % theme.accents.length] ?? theme.node.cap;
}
