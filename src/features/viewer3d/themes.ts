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
  tagline: 'Gris claro, bloques blancos y acentos por dominio',
  dark: false,
  background: '#F4F5F8',
  ground: { kind: 'shadow', color: '#0D1B2E', opacity: 0.12 },
  camera: { projection: 'orthographic', azimuthDeg: 45, elevationDeg: 35.264, fov: 30 },
  light: {
    ambient: { color: '#ffffff', intensity: 0.55 },
    hemi: { sky: '#ffffff', ground: '#d8dde5', intensity: 0.6 },
    key: { color: '#ffffff', intensity: 1.6, position: [6, 12, 4] },
    fill: { color: '#e8eef5', intensity: 0.35, position: [-6, 5, -4] },
    shadows: true,
  },
  platform: { treatment: 'slab', colors: ['#E6E9EF', '#DCE0E7', '#D1D6DF'], opacity: 1, edge: '#B7BEC9', edgeOpacity: 0.9, title: '#2A2F3A', dimensions: false },
  node: { finish: 'matte', body: '#FFFFFF', cap: '#C9D0DA', edges: false, edgeColor: '#8A93A3', roughness: 0.85, metalness: 0, heightScale: 1, plateText: '#0D1B2E', detail: '#2A3445', glassOpacity: 0.74 },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.022,
    colors: { default: '#3C4250', telemetry: '#7A8291', dependency: '#8A93A3' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#0D1B2E', outline: '#F4F5F8', muted: '#5C6675', weight: 500, size: 0.15 },
  accents: ['#D9653B', '#3E7C74', '#C39A2E', '#5B6F9A', '#8A5A83'],
  selection: '#2563EB',
  particles: '#2563EB',
  overlay: 'light',
};

const midnight: ThemeTokens = {
  id: 'midnight',
  name: 'Midnight Signal',
  tagline: 'Carbón, volumen oscuro, luz lateral, señales cian/ámbar',
  dark: true,
  background: '#121315',
  ground: { kind: 'dots', color: '#2A2C30', opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 38, elevationDeg: 32, fov: 30 },
  light: {
    ambient: { color: '#9fb2c8', intensity: 0.4 },
    key: { color: '#ffffff', intensity: 2.4, position: [10, 7, -3] },
    fill: { color: '#5fd4e6', intensity: 0.35, position: [-2, 3, 9] },
    shadows: true,
  },
  platform: { treatment: 'deck', colors: ['#22252B', '#2A2E35', '#32373F'], opacity: 1, edge: '#4A505B', edgeOpacity: 1, title: '#D5D9DE', dimensions: false },
  node: { finish: 'satin', body: '#4D535E', cap: '#626A77', edges: true, edgeColor: '#7D8591', roughness: 0.55, metalness: 0.15, heightScale: 1.05, plateText: '#E8EAED', detail: '#C9D3E0', glassOpacity: 0.5 },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.016,
    colors: { default: '#5FD4E6', event: '#F0B44C', async: '#F0B44C', telemetry: '#6C7480', dependency: '#6C7480' },
    arrow: 'chevron',
    arrowColor: null,
    opacity: 0.95,
  },
  label: { color: '#ECEEF1', outline: '#121315', muted: '#9AA1AB', weight: 500, size: 0.15 },
  accents: ['#5FD4E6', '#F0B44C', '#8C9BB0', '#5FD4E6', '#F0B44C'],
  selection: '#8FB0FF',
  particles: '#F0B44C',
  overlay: 'dark',
};

const glass: ThemeTokens = {
  id: 'glass',
  name: 'Glass Layers',
  tagline: 'Plataformas translúcidas, bloques sólidos y capas separadas',
  dark: true,
  background: '#16201F',
  ground: { kind: 'none', color: '#000000', opacity: 0 },
  camera: { projection: 'orthographic', azimuthDeg: 45, elevationDeg: 30, fov: 30 },
  light: {
    ambient: { color: '#d6f0ec', intensity: 0.45 },
    hemi: { sky: '#cfeee8', ground: '#16201F', intensity: 0.5 },
    key: { color: '#ffffff', intensity: 1.5, position: [5, 10, 6] },
    shadows: false,
  },
  platform: { treatment: 'glass', colors: ['#8FD3C7', '#A9C8E6', '#D7E7C9'], opacity: 0.16, edge: '#CFF3EC', edgeOpacity: 0.85, title: '#E4F4F1', dimensions: false },
  node: { finish: 'solid', body: '#F4F7F6', cap: '#8FD3C7', edges: false, edgeColor: '#ffffff', roughness: 0.35, metalness: 0.05, heightScale: 0.95, plateText: '#16201F', detail: '#16201F', glassOpacity: 0.5 },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.02,
    colors: { default: '#E9F6F3', response: '#8FD3C7', telemetry: '#7FA39C', dependency: '#7FA39C' },
    arrow: 'cone',
    arrowColor: '#FFFFFF',
    opacity: 0.95,
  },
  label: { color: '#F2FAF8', outline: '#16201F', muted: '#A7C2BD', weight: 500, size: 0.15 },
  accents: ['#8FD3C7', '#A9C8E6', '#E2C98F', '#D7A6C0', '#B9D98F'],
  selection: '#7FE3F5',
  particles: '#FFFFFF',
  overlay: 'dark',
};

const blueprint: ThemeTokens = {
  id: 'blueprint',
  name: 'Blueprint Spatial',
  tagline: 'Azul técnico, líneas finas, cotas y límites reconocibles',
  dark: true,
  background: '#0E3150',
  ground: { kind: 'grid', color: '#1A4467', opacity: 1 },
  camera: { projection: 'orthographic', azimuthDeg: 45, elevationDeg: 35.264, fov: 30 },
  light: {
    ambient: { color: '#ffffff', intensity: 1.0 },
    key: { color: '#ffffff', intensity: 0.6, position: [4, 10, 6] },
    shadows: false,
  },
  platform: { treatment: 'outline', colors: ['#14406A', '#184A78', '#1C5486'], opacity: 0.55, edge: '#CFE3F5', edgeOpacity: 0.9, title: '#E6F0FA', dimensions: true },
  node: { finish: 'wire', body: '#1A4A75', cap: '#22598A', edges: true, edgeColor: '#EAF3FC', roughness: 1, metalness: 0, heightScale: 0.9, plateText: '#EAF3FC', detail: '#EAF3FC', glassOpacity: 0.35 },
  connector: {
    route: 'orthogonal',
    render: 'line',
    radius: 0.012,
    colors: { default: '#EAF3FC', event: '#9CC8EE', async: '#9CC8EE', telemetry: '#7FA9CF', dependency: '#7FA9CF' },
    arrow: 'chevron',
    arrowColor: '#EAF3FC',
    opacity: 1,
  },
  label: { color: '#F2F7FC', outline: '#0E3150', muted: '#A9C6E2', weight: 500, size: 0.14 },
  accents: ['#EAF3FC', '#9CC8EE', '#F3D58A', '#EAF3FC', '#9CC8EE'],
  selection: '#7FE3F5',
  particles: '#F3D58A',
  overlay: 'dark',
};

const monochrome: ThemeTokens = {
  id: 'monochrome',
  name: 'Monochrome Editorial',
  tagline: 'Blanco y negro, jerarquía tipográfica y formas por función',
  dark: false,
  background: '#FAFAF7',
  ground: { kind: 'shadow', color: '#000000', opacity: 0.08 },
  camera: { projection: 'orthographic', azimuthDeg: 52, elevationDeg: 38, fov: 30 },
  light: {
    ambient: { color: '#ffffff', intensity: 0.7 },
    key: { color: '#ffffff', intensity: 1.4, position: [3, 12, 7] },
    fill: { color: '#ffffff', intensity: 0.3, position: [-8, 4, -2] },
    shadows: true,
  },
  platform: { treatment: 'plate', colors: ['#FFFFFF', '#F0F0EC', '#E4E4DF'], opacity: 1, edge: '#0D1B2E', edgeOpacity: 1, title: '#0D1B2E', dimensions: false },
  node: { finish: 'ink', body: '#FFFFFF', cap: '#0D1B2E', edges: true, edgeColor: '#0D1B2E', roughness: 0.9, metalness: 0, heightScale: 1, plateText: '#FFFFFF', detail: '#0D1B2E', glassOpacity: 0.3 },
  connector: {
    route: 'orthogonal',
    render: 'tube',
    radius: 0.014,
    colors: { default: '#0D1B2E', telemetry: '#6B6B66', dependency: '#6B6B66' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#0D1B2E', outline: '#FAFAF7', muted: '#55554F', weight: 700, size: 0.15 },
  accents: ['#0D1B2E', '#0D1B2E', '#0D1B2E', '#0D1B2E', '#0D1B2E'],
  selection: '#2563EB',
  particles: '#0D1B2E',
  overlay: 'light',
};

const orbit: ThemeTokens = {
  id: 'orbit',
  name: 'Orbit Atlas',
  tagline: 'Perspectiva moderada, islas y conexiones elevadas en arco',
  dark: false,
  background: '#E7E3D8',
  ground: { kind: 'none', color: '#000000', opacity: 0 },
  camera: { projection: 'perspective', azimuthDeg: 30, elevationDeg: 30, fov: 32 },
  light: {
    ambient: { color: '#ffffff', intensity: 0.5 },
    hemi: { sky: '#fbf7ee', ground: '#a99f8c', intensity: 0.7 },
    key: { color: '#fff1dc', intensity: 1.7, position: [8, 14, 6] },
    shadows: true,
  },
  platform: { treatment: 'island', colors: ['#CFC6B3', '#C4BAA4', '#B9AE96'], opacity: 1, edge: '#9C917B', edgeOpacity: 1, title: '#2E2A24', dimensions: false },
  node: { finish: 'matte', body: '#F7F3EA', cap: '#B9AE96', edges: false, edgeColor: '#7A705E', roughness: 0.8, metalness: 0, heightScale: 1.1, plateText: '#0D1B2E', detail: '#3A3328', glassOpacity: 0.74 },
  connector: {
    route: 'arc',
    render: 'tube',
    radius: 0.024,
    colors: { default: '#2F4A5E', telemetry: '#5E7A8C', control: '#B4552E', dependency: '#7A8C96' },
    arrow: 'cone',
    arrowColor: null,
    opacity: 1,
  },
  label: { color: '#1E1B16', outline: '#E7E3D8', muted: '#5A5246', weight: 500, size: 0.16 },
  accents: ['#2F6B5E', '#B4552E', '#3D5C7A', '#A07A2C', '#6B4E78'],
  selection: '#2563EB',
  particles: '#B4552E',
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
