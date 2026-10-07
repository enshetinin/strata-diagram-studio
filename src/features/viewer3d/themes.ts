/**
 * Declarative style presets. A theme only describes materials, geometry
 * treatment, light, camera and connectors; it never touches the graph.
 */
import type { RelationKind, StyleId } from '../../domain/types';

export type PlatformTreatment = 'slab' | 'glass' | 'outline' | 'plate' | 'island' | 'deck';
export type NodeFinish = 'matte' | 'satin' | 'solid' | 'wire' | 'ink';

export interface ThemeTokens {
  id: StyleId;
  name: string;
  tagline: string;
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
  accents: string[];
  selection: string;
  particles: string;
  /** UI hint for the legend / overlays drawn over the canvas. */
  overlay: 'light' | 'dark';
}

const porcelain: ThemeTokens = {
  id: 'porcelain',
  name: 'Porcelain Isometric',
  tagline: 'Gris claro, bloques blancos, línea fina y acentos azules',
  dark: false,
  background: '#F4F5F8',
  ground: { kind: 'shadow', color: '#0D1B2E', opacity: 0.1 },
  camera: { projection: 'orthographic', azimuthDeg: 34, elevationDeg: 30, fov: 30 },
  light: {
    exposure: 1.3,
    ambient: { color: '#ffffff', intensity: 0.5 },
    hemi: { sky: '#ffffff', ground: '#cfd6e0', intensity: 0.7 },
    key: { color: '#ffffff', intensity: 1.7, position: [-4, 12, 7] },
    fill: { color: '#e6edf7', intensity: 0.45, position: [8, 5, -2] },
    shadows: true,
  },
  platform: {
    treatment: 'plate',
    colors: ['#FFFFFF', '#F0F2F6', '#E6E9EF'],
    opacity: 1,
    edge: '#C3CAD5',
    edgeOpacity: 1,
    title: '#0D1B2E',
    dimensions: false,
  },
  node: {
    finish: 'matte',
    body: '#FFFFFF',
    cap: '#BFD9F7',
    edges: true,
    edgeColor: '#0D1B2E',
    edgeOpacity: 0.55,
    roughness: 0.8,
    metalness: 0,
    heightScale: 1,
    plateText: '#0D1B2E',
    detail: '#0D1B2E',
    glassOpacity: 0.7,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.018,
    colors: { default: '#0D1B2E', telemetry: '#8A93A3', dependency: '#8A93A3', backup: '#8A93A3' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#0D1B2E', outline: '#FFFFFF', muted: '#5C6675', weight: 500, size: 0.15 },
  accents: ['#2563EB', '#38A3C9', '#8DB4FF', '#1F4F8A', '#7FCBDD'],
  selection: '#2563EB',
  particles: '#2563EB',
  overlay: 'light',
};

const midnight: ThemeTokens = {
  id: 'midnight',
  name: 'Midnight Signal',
  tagline: 'Negro grafito, volumen oscuro, luz lateral y señales cian',
  dark: true,
  background: '#050608',
  ground: { kind: 'dots', color: '#1A1D23', opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 34, elevationDeg: 30, fov: 30 },
  light: {
    exposure: 1.0,
    ambient: { color: '#b5bcc8', intensity: 0.4 },
    hemi: { sky: '#8db4ff', ground: '#050608', intensity: 0.25 },
    key: { color: '#ffffff', intensity: 2.3, position: [-6, 9, 8] },
    fill: { color: '#5fd4e6', intensity: 0.4, position: [9, 3, -2] },
    shadows: true,
  },
  platform: {
    treatment: 'deck',
    colors: ['#0E1014', '#14171C', '#1B1F26'],
    opacity: 1,
    edge: '#2C323C',
    edgeOpacity: 1,
    title: '#F2F2F3',
    dimensions: false,
  },
  node: {
    finish: 'satin',
    body: '#2A2F38',
    cap: '#3A414D',
    edges: true,
    edgeColor: '#7C8696',
    edgeOpacity: 0.7,
    roughness: 0.5,
    metalness: 0.15,
    heightScale: 1.05,
    plateText: '#F2F2F3',
    detail: '#D6DCE5',
    glassOpacity: 0.55,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.016,
    colors: {
      default: '#5FD4E6',
      event: '#8DB4FF',
      async: '#8DB4FF',
      telemetry: '#5A606B',
      dependency: '#5A606B',
      backup: '#5A606B',
    },
    arrow: 'chevron',
    arrowColor: null,
    opacity: 0.95,
  },
  label: { color: '#F2F2F3', outline: '#050608', muted: '#9A9FA8', weight: 500, size: 0.15 },
  accents: ['#5FD4E6', '#8DB4FF', '#BFD9F7', '#3FA7D6', '#7FCBDD'],
  selection: '#BFD9F7',
  particles: '#5FD4E6',
  overlay: 'dark',
};

const glass: ThemeTokens = {
  id: 'glass',
  name: 'Glass Layers',
  tagline: 'Plataformas translúcidas, bloques sólidos y capas separadas',
  dark: true,
  background: '#0F1A2B',
  ground: { kind: 'none', color: '#000000', opacity: 0 },
  camera: { projection: 'orthographic', azimuthDeg: 36, elevationDeg: 28, fov: 30 },
  light: {
    exposure: 1.0,
    ambient: { color: '#dbe7f7', intensity: 0.45 },
    hemi: { sky: '#d6e7fb', ground: '#0F1A2B', intensity: 0.5 },
    key: { color: '#ffffff', intensity: 1.5, position: [-4, 10, 7] },
    shadows: false,
  },
  platform: {
    treatment: 'glass',
    colors: ['#8DB4FF', '#5FD4E6', '#BFD9F7'],
    opacity: 0.13,
    edge: '#BFD9F7',
    edgeOpacity: 0.8,
    title: '#EEF2F8',
    dimensions: false,
  },
  node: {
    finish: 'solid',
    body: '#F4F7FB',
    cap: '#8DB4FF',
    edges: false,
    edgeColor: '#ffffff',
    edgeOpacity: 1,
    roughness: 0.35,
    metalness: 0.05,
    heightScale: 0.95,
    plateText: '#0F1A2B',
    detail: '#0F1A2B',
    glassOpacity: 0.5,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.018,
    colors: { default: '#EEF2F8', response: '#5FD4E6', telemetry: '#7F93B3', dependency: '#7F93B3', backup: '#7F93B3' },
    arrow: 'cone',
    arrowColor: '#FFFFFF',
    opacity: 0.95,
  },
  label: { color: '#EEF2F8', outline: '#0F1A2B', muted: '#9AA6B8', weight: 500, size: 0.15 },
  accents: ['#8DB4FF', '#5FD4E6', '#BFD9F7', '#3FA7D6', '#7FCBDD'],
  selection: '#7FE3F5',
  particles: '#FFFFFF',
  overlay: 'dark',
};

const blueprint: ThemeTokens = {
  id: 'blueprint',
  name: 'Blueprint Spatial',
  tagline: 'Azul técnico, líneas finas, cotas y límites reconocibles',
  dark: true,
  background: '#0D2A4A',
  ground: { kind: 'grid', color: '#163B61', opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 36, elevationDeg: 32, fov: 30 },
  light: {
    exposure: 1.0,
    ambient: { color: '#ffffff', intensity: 1.0 },
    key: { color: '#ffffff', intensity: 0.6, position: [4, 10, 6] },
    shadows: false,
  },
  platform: {
    treatment: 'outline',
    colors: ['#123A62', '#164470', '#1A4E7E'],
    opacity: 0.55,
    edge: '#CFE3F5',
    edgeOpacity: 0.9,
    title: '#E6F0FA',
    dimensions: true,
  },
  node: {
    finish: 'wire',
    body: '#174571',
    cap: '#1F5585',
    edges: true,
    edgeColor: '#EAF3FC',
    edgeOpacity: 1,
    roughness: 1,
    metalness: 0,
    heightScale: 0.9,
    plateText: '#EAF3FC',
    detail: '#EAF3FC',
    glassOpacity: 0.35,
  },
  connector: {
    route: 'orthogonal',
    render: 'line',
    radius: 0.012,
    colors: {
      default: '#EAF3FC',
      event: '#9CC8EE',
      async: '#9CC8EE',
      telemetry: '#7FA9CF',
      dependency: '#7FA9CF',
      backup: '#7FA9CF',
    },
    arrow: 'chevron',
    arrowColor: '#EAF3FC',
    opacity: 1,
  },
  label: { color: '#F2F7FC', outline: '#0D2A4A', muted: '#A9C6E2', weight: 500, size: 0.14 },
  accents: ['#EAF3FC', '#9CC8EE', '#7FE3F5', '#EAF3FC', '#9CC8EE'],
  selection: '#7FE3F5',
  particles: '#7FE3F5',
  overlay: 'dark',
};

const monochrome: ThemeTokens = {
  id: 'monochrome',
  name: 'Monochrome Editorial',
  tagline: 'Blanco y tinta, jerarquía tipográfica y formas por función',
  dark: false,
  background: '#FFFFFF',
  ground: { kind: 'shadow', color: '#0D1B2E', opacity: 0.07 },
  camera: { projection: 'orthographic', azimuthDeg: 30, elevationDeg: 32, fov: 30 },
  light: {
    exposure: 1.7,
    ambient: { color: '#ffffff', intensity: 0.55 },
    hemi: { sky: '#ffffff', ground: '#dfe3ea', intensity: 0.8 },
    key: { color: '#ffffff', intensity: 1.8, position: [-3, 12, 8] },
    fill: { color: '#ffffff', intensity: 0.3, position: [8, 4, -2] },
    shadows: true,
  },
  platform: {
    treatment: 'plate',
    colors: ['#FFFFFF', '#F7F8FA', '#EEF0F4'],
    opacity: 1,
    edge: '#0D1B2E',
    edgeOpacity: 1,
    title: '#0D1B2E',
    dimensions: false,
  },
  node: {
    finish: 'ink',
    body: '#FFFFFF',
    cap: '#0D1B2E',
    edges: true,
    edgeColor: '#0D1B2E',
    edgeOpacity: 1,
    roughness: 0.9,
    metalness: 0,
    heightScale: 1,
    plateText: '#FFFFFF',
    detail: '#0D1B2E',
    glassOpacity: 0.3,
  },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.013,
    colors: { default: '#0D1B2E', telemetry: '#5C6675', dependency: '#5C6675', backup: '#5C6675' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#0D1B2E', outline: '#FFFFFF', muted: '#5C6675', weight: 700, size: 0.15 },
  accents: ['#0D1B2E', '#0D1B2E', '#0D1B2E', '#0D1B2E', '#0D1B2E'],
  selection: '#2563EB',
  particles: '#2563EB',
  overlay: 'light',
};

const orbit: ThemeTokens = {
  id: 'orbit',
  name: 'Orbit Atlas',
  tagline: 'Perspectiva moderada, islas blancas y conexiones elevadas en arco',
  dark: false,
  background: '#E9ECF1',
  ground: { kind: 'none', color: '#000000', opacity: 0 },
  camera: { projection: 'perspective', azimuthDeg: 28, elevationDeg: 30, fov: 32 },
  light: {
    exposure: 1.25,
    ambient: { color: '#ffffff', intensity: 0.5 },
    hemi: { sky: '#ffffff', ground: '#9aa6b8', intensity: 0.7 },
    key: { color: '#ffffff', intensity: 1.7, position: [-5, 14, 8] },
    shadows: true,
  },
  platform: {
    treatment: 'island',
    colors: ['#FFFFFF', '#F4F5F8', '#E9ECF1'],
    opacity: 1,
    edge: '#C3CAD5',
    edgeOpacity: 1,
    title: '#0D1B2E',
    dimensions: false,
  },
  node: {
    finish: 'matte',
    body: '#FFFFFF',
    cap: '#BFD9F7',
    edges: false,
    edgeColor: '#5C6675',
    edgeOpacity: 1,
    roughness: 0.8,
    metalness: 0,
    heightScale: 1.1,
    plateText: '#0D1B2E',
    detail: '#0D1B2E',
    glassOpacity: 0.72,
  },
  connector: {
    route: 'arc',
    render: 'tube',
    radius: 0.022,
    colors: { default: '#1F4F8A', telemetry: '#8A93A3', control: '#2563EB', dependency: '#8A93A3', backup: '#8A93A3' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#0D1B2E', outline: '#FFFFFF', muted: '#5C6675', weight: 500, size: 0.16 },
  accents: ['#2563EB', '#38A3C9', '#1F4F8A', '#8DB4FF', '#7FCBDD'],
  selection: '#2563EB',
  particles: '#2563EB',
  overlay: 'light',
};

export const THEMES: Record<StyleId, ThemeTokens> = { porcelain, midnight, glass, blueprint, monochrome, orbit };

export function connectorColor(theme: ThemeTokens, relation: RelationKind): string {
  return theme.connector.colors[relation] ?? theme.connector.colors.default;
}

export function accentColor(theme: ThemeTokens, accent: number): string {
  if (accent < 0) return theme.node.cap;
  return theme.accents[accent % theme.accents.length] ?? theme.node.cap;
}
