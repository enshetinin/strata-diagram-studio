/**
 * Canonical, renderer-independent diagram model.
 *
 * Nothing in this file may reference React Flow, Three.js, the DOM or class
 * instances: the document must survive `JSON.stringify` / `JSON.parse`
 * unchanged.
 */

export const SCHEMA_VERSION = 1 as const;

export const NODE_KINDS = [
  'client',
  'frontend',
  'api',
  'service',
  'function',
  'database',
  'storage',
  'queue',
  'cache',
  'agent',
  'model',
  'tool',
  'gateway',
  'observability',
  'generic',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const PORT_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type PortSide = (typeof PORT_SIDES)[number];

export const PORT_DIRECTIONS = ['in', 'out', 'inout'] as const;
export type PortDirection = (typeof PORT_DIRECTIONS)[number];

/** What travels through a port. `any` is compatible with every type. */
export const PORT_DATA_TYPES = ['any', 'request', 'data', 'event', 'control', 'telemetry'] as const;
export type PortDataType = (typeof PORT_DATA_TYPES)[number];

export const RELATION_KINDS = [
  'request',
  'response',
  'data',
  'event',
  'async',
  'dependency',
  'telemetry',
  'control',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const EDGE_DIRECTIONS = ['forward', 'bidirectional'] as const;
export type EdgeDirection = (typeof EDGE_DIRECTIONS)[number];

export const GROUP_KINDS = ['domain', 'region', 'network', 'cluster', 'lane', 'zone'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Port {
  id: string;
  side: PortSide;
  direction: PortDirection;
  dataType: PortDataType;
  label?: string;
}

export interface DiagramNode {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  /** Free text such as "AWS" or "Self-hosted". Never implies an official logo. */
  provider?: string;
  ports: Port[];
  groupId: string | null;
  metadata: JsonObject;
}

export interface DiagramGroup {
  id: string;
  label: string;
  description?: string;
  kind: GroupKind;
  parentGroupId: string | null;
}

export interface EdgeEndpoint {
  nodeId: string;
  portId: string;
}

export interface DiagramEdge {
  id: string;
  source: EdgeEndpoint;
  target: EdgeEndpoint;
  relation: RelationKind;
  label?: string;
  direction: EdgeDirection;
  /** Optional 1-based position in the explained walkthrough. */
  order?: number;
  explanation?: string;
}

/** Rectangle in canvas pixels, local to the parent group (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramLayout {
  nodes: Record<string, Rect>;
  groups: Record<string, Rect>;
}

export const STYLE_IDS = ['porcelain', 'midnight', 'glass', 'blueprint', 'monochrome', 'orbit'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const LABEL_MODES = ['all', 'auto', 'selection'] as const;
export type LabelMode = (typeof LABEL_MODES)[number];

export type CameraProjection = 'style' | 'orthographic' | 'perspective';

export interface CameraSettings {
  /** `style` defers to the style preset (Orbit Atlas uses perspective). */
  projection: CameraProjection;
}

export interface AppearanceSettings {
  /** Multiplier applied by auto-layout to node spacing (0.6 – 1.8). */
  spacing: number;
  /** Visual height between nested group layers in the 3D scene (world units). */
  layerHeight: number;
  labelMode: LabelMode;
  /** Illustrative flow particles on the selected / narrated relation. */
  flowParticles: boolean;
}

export interface Presentation {
  styleId: StyleId;
  camera: CameraSettings;
  appearance: AppearanceSettings;
}

export interface NarrativeStep {
  id: string;
  title: string;
  caption?: string;
  edgeIds: string[];
}

export interface Narrative {
  steps: NarrativeStep[];
}

export interface DiagramDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  nodes: DiagramNode[];
  groups: DiagramGroup[];
  edges: DiagramEdge[];
  layout: DiagramLayout;
  presentation: Presentation;
  narrative: Narrative;
}

export type ElementType = 'node' | 'edge' | 'group';

export interface ElementRef {
  type: ElementType;
  id: string;
}

export const DEFAULT_NODE_SIZE = { width: 176, height: 80 } as const;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  spacing: 1,
  layerHeight: 0.5,
  labelMode: 'auto',
  flowParticles: true,
};
