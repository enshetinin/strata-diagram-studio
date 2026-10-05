import type { DiagramDocument, DiagramGroup, Port, PortSide, Rect } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Group padding used when a group grows to contain its children (pixels). */
export const GROUP_PADDING = { top: 56, right: 32, bottom: 32, left: 32 } as const;

export interface AbsoluteLayout {
  nodes: Map<string, Rect>;
  groups: Map<string, Rect>;
  /** Nesting depth of each group (top-level = 0). */
  groupDepth: Map<string, number>;
}

/**
 * Resolves group-local rectangles into absolute canvas rectangles.
 * Each group offset is applied exactly once, walking up the parent chain.
 */
export function resolveAbsoluteLayout(doc: DiagramDocument): AbsoluteLayout {
  const groupsById = new Map<string, DiagramGroup>(doc.groups.map((group) => [group.id, group]));
  const groupOrigin = new Map<string, Point>();
  const groupDepth = new Map<string, number>();

  const originOf = (groupId: string, guard: Set<string>): Point => {
    const cached = groupOrigin.get(groupId);
    if (cached) return cached;
    const group = groupsById.get(groupId);
    const rect = doc.layout.groups[groupId];
    if (!group || !rect || guard.has(groupId)) return { x: 0, y: 0 };
    guard.add(groupId);
    const parentOrigin = group.parentGroupId ? originOf(group.parentGroupId, guard) : { x: 0, y: 0 };
    const depth = group.parentGroupId ? (groupDepth.get(group.parentGroupId) ?? 0) + 1 : 0;
    groupDepth.set(groupId, depth);
    const origin = { x: parentOrigin.x + rect.x, y: parentOrigin.y + rect.y };
    groupOrigin.set(groupId, origin);
    return origin;
  };

  const groups = new Map<string, Rect>();
  for (const group of doc.groups) {
    const rect = doc.layout.groups[group.id];
    if (!rect) continue;
    const origin = originOf(group.id, new Set());
    groups.set(group.id, { x: origin.x, y: origin.y, width: rect.width, height: rect.height });
  }

  const nodes = new Map<string, Rect>();
  for (const node of doc.nodes) {
    const rect = doc.layout.nodes[node.id];
    if (!rect) continue;
    const origin = node.groupId ? (groupOrigin.get(node.groupId) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    nodes.set(node.id, { x: origin.x + rect.x, y: origin.y + rect.y, width: rect.width, height: rect.height });
  }

  return { nodes, groups, groupDepth };
}

/** Absolute origin (top-left) of a container; `null` is the canvas. */
export function containerOrigin(doc: DiagramDocument, groupId: string | null, abs?: AbsoluteLayout): Point {
  if (groupId === null) return { x: 0, y: 0 };
  const layout = abs ?? resolveAbsoluteLayout(doc);
  const rect = layout.groups.get(groupId);
  return rect ? { x: rect.x, y: rect.y } : { x: 0, y: 0 };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

export function documentBounds(doc: DiagramDocument, abs?: AbsoluteLayout): Rect {
  const layout = abs ?? resolveAbsoluteLayout(doc);
  return unionRects([...layout.nodes.values(), ...layout.groups.values()]) ?? { x: 0, y: 0, width: 800, height: 600 };
}

/**
 * Position of a port on its node boundary, relative to the node's top-left.
 * Ports sharing a side are spread evenly; 2D handles and 3D anchors both use it.
 */
export function portOffset(rect: Pick<Rect, 'width' | 'height'>, port: Port, ports: readonly Port[]): Point {
  const sameSide = ports.filter((candidate) => candidate.side === port.side);
  const index = Math.max(0, sameSide.findIndex((candidate) => candidate.id === port.id));
  const fraction = (index + 1) / (sameSide.length + 1);
  switch (port.side) {
    case 'top':
      return { x: rect.width * fraction, y: 0 };
    case 'bottom':
      return { x: rect.width * fraction, y: rect.height };
    case 'left':
      return { x: 0, y: rect.height * fraction };
    case 'right':
      return { x: rect.width, y: rect.height * fraction };
  }
}

/** Fraction (0–1) along the side where a port sits; used by 2D handle styling. */
export function portFraction(port: Port, ports: readonly Port[]): number {
  const sameSide = ports.filter((candidate) => candidate.side === port.side);
  const index = Math.max(0, sameSide.findIndex((candidate) => candidate.id === port.id));
  return (index + 1) / (sameSide.length + 1);
}

export const SIDE_NORMAL: Record<PortSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
