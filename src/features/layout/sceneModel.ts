/**
 * Pure conversion from the canonical 2D layout to a 3D scene description.
 *
 * World convention (see docs/coordinates.md):
 *  - X/Z is the ground plane, Y is height.
 *  - 1 world unit = 100 canvas pixels (WORLD_SCALE = 0.01).
 *  - Canvas +x → world +x, canvas +y → world +z.
 *  - The scene is centred on the document bounds.
 * Every element (groups, nodes, ports, route points) goes through the same
 * `toWorld` transform, so nested groups are never offset twice.
 */
import { KIND_INFO } from '../../domain/catalog';
import { documentBounds, portOffset, resolveAbsoluteLayout, SIDE_NORMAL, type Point } from '../../domain/geometry';
import type { DiagramDocument, DiagramEdge, NodeKind, Rect, RelationKind } from '../../domain/types';

export const WORLD_SCALE = 0.01;
export const PLATFORM_THICKNESS = 0.08;
const PORT_HEIGHT = 0.2;
const STUB = 0.24;
const CLEARANCE = 0.26;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface WorldTransform {
  scale: number;
  center: Point;
  toWorld(point: Point): { x: number; z: number };
}

export function createWorldTransform(bounds: Rect, scale = WORLD_SCALE): WorldTransform {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return {
    scale,
    center,
    toWorld: (point) => ({ x: (point.x - center.x) * scale, z: (point.y - center.y) * scale }),
  };
}

/** Axis-aligned box: centre on the ground plane plus vertical extent. */
export interface WorldBox {
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
  bottom: number;
  top: number;
}

export interface SceneGroup extends WorldBox {
  id: string;
  label: string;
  depth: number;
  /** Index of the top-level ancestor; drives domain accents. */
  accent: number;
  parentGroupId: string | null;
}

export interface SceneNode extends WorldBox {
  id: string;
  kind: NodeKind;
  label: string;
  groupId: string | null;
  accent: number;
}

export interface SceneEdge {
  id: string;
  relation: RelationKind;
  label?: string;
  order?: number;
  bidirectional: boolean;
  sourceId: string;
  targetId: string;
  points: Vec3[];
  /** Point where a label is placed (middle of the route by length). */
  labelAt: Vec3;
  routing: 'flat' | 'elevated' | 'arc';
}

export interface SceneModel {
  groups: SceneGroup[];
  nodes: SceneNode[];
  edges: SceneEdge[];
  ports: { nodeId: string; portId: string; position: Vec3 }[];
  /** World-space bounds of everything (for camera fitting). */
  bounds: { min: Vec3; max: Vec3 };
}

export interface SceneOptions {
  layerHeight: number;
  heightScale: number;
  routeStyle: 'orthogonal' | 'arc';
}

function rectToBox(rect: Rect, transform: WorldTransform, bottom: number, top: number): WorldBox {
  const center = transform.toWorld({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  return { x: center.x, z: center.z, sizeX: rect.width * transform.scale, sizeZ: rect.height * transform.scale, bottom, top };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

/** Does an axis-aligned segment on the ground plane cross a box footprint? */
function segmentHitsBox(a: Vec3, b: Vec3, box: WorldBox, margin: number): boolean {
  const minX = box.x - box.sizeX / 2 - margin;
  const maxX = box.x + box.sizeX / 2 + margin;
  const minZ = box.z - box.sizeZ / 2 - margin;
  const maxZ = box.z + box.sizeZ / 2 + margin;
  const segMinX = Math.min(a.x, b.x);
  const segMaxX = Math.max(a.x, b.x);
  const segMinZ = Math.min(a.z, b.z);
  const segMaxZ = Math.max(a.z, b.z);
  return segMinX <= maxX && segMaxX >= minX && segMinZ <= maxZ && segMaxZ >= minZ;
}

function dedupe(points: Vec3[]): Vec3[] {
  const result: Vec3[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && Math.abs(last.x - point.x) < 1e-6 && Math.abs(last.y - point.y) < 1e-6 && Math.abs(last.z - point.z) < 1e-6) continue;
    result.push(point);
  }
  // Remove collinear interior points so tubes get clean corners.
  return result.filter((point, index) => {
    const prev = result[index - 1];
    const next = result[index + 1];
    if (!prev || !next) return true;
    const ax = point.x - prev.x;
    const ay = point.y - prev.y;
    const az = point.z - prev.z;
    const bx = next.x - point.x;
    const by = next.y - point.y;
    const bz = next.z - point.z;
    const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
    return cross > 1e-6;
  });
}

export function polylineMidpoint(points: Vec3[]): Vec3 {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  let remaining = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= length;
  }
  return points[0] ?? { x: 0, y: 0, z: 0 };
}

function cubic(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    z: a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  };
}

export function buildSceneModel(doc: DiagramDocument, options: SceneOptions): SceneModel {
  const abs = resolveAbsoluteLayout(doc);
  const transform = createWorldTransform(documentBounds(doc, abs));
  const layer = options.layerHeight;

  const topLevelIndex = new Map<string, number>();
  doc.groups.filter((group) => group.parentGroupId === null).forEach((group, index) => topLevelIndex.set(group.id, index));
  const groupsById = new Map(doc.groups.map((group) => [group.id, group]));
  const accentOf = (groupId: string | null): number => {
    let current = groupId;
    let guard = 0;
    while (current && guard < 100) {
      const group = groupsById.get(current);
      if (!group) break;
      if (group.parentGroupId === null) return topLevelIndex.get(group.id) ?? -1;
      current = group.parentGroupId;
      guard += 1;
    }
    return -1;
  };

  const platformTop = (depth: number) => (depth + 1) * PLATFORM_THICKNESS + depth * layer;

  const groups: SceneGroup[] = doc.groups.flatMap((group) => {
    const rect = abs.groups.get(group.id);
    if (!rect) return [];
    const depth = abs.groupDepth.get(group.id) ?? 0;
    const top = platformTop(depth);
    return [{ ...rectToBox(rect, transform, top - PLATFORM_THICKNESS, top), id: group.id, label: group.label, depth, accent: accentOf(group.id), parentGroupId: group.parentGroupId }];
  });
  const groupBox = new Map(groups.map((group) => [group.id, group]));

  const nodes: SceneNode[] = doc.nodes.flatMap((node) => {
    const rect = abs.nodes.get(node.id);
    if (!rect) return [];
    const base = node.groupId ? (groupBox.get(node.groupId)?.top ?? 0) : 0;
    const height = KIND_INFO[node.kind].height * options.heightScale;
    return [{ ...rectToBox(rect, transform, base, base + height), id: node.id, kind: node.kind, label: node.label, groupId: node.groupId, accent: accentOf(node.groupId) }];
  });
  const nodeBox = new Map(nodes.map((node) => [node.id, node]));

  const portWorld = (nodeId: string, portId: string): { position: Vec3; normal: Point } | null => {
    const node = doc.nodes.find((candidate) => candidate.id === nodeId);
    const rect = abs.nodes.get(nodeId);
    const box = nodeBox.get(nodeId);
    const port = node?.ports.find((candidate) => candidate.id === portId);
    if (!node || !rect || !box || !port) return null;
    const offset = portOffset(rect, port, node.ports);
    const ground = transform.toWorld({ x: rect.x + offset.x, y: rect.y + offset.y });
    const y = box.bottom + Math.min(PORT_HEIGHT, (box.top - box.bottom) * 0.45);
    return { position: { x: ground.x, y, z: ground.z }, normal: SIDE_NORMAL[port.side] };
  };

  const ports: SceneModel['ports'] = [];
  const usedPorts = new Set<string>();

  const obstacleTop = (a: Vec3, b: Vec3): number => {
    let top = 0;
    const segA = { x: Math.min(a.x, b.x), y: 0, z: Math.min(a.z, b.z) };
    const segB = { x: Math.max(a.x, b.x), y: 0, z: Math.max(a.z, b.z) };
    for (const box of [...nodes, ...groups]) {
      // Bounding rectangle of the whole route on the ground plane.
      if (segmentHitsBox(segA, segB, box, 0.05)) top = Math.max(top, box.top);
    }
    return top;
  };

  const flatPathClear = (points: Vec3[], y: number, endpoints: Set<string>): boolean => {
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]!;
      const b = points[index]!;
      for (const node of nodes) {
        if (node.bottom > y || node.top < y - 0.05) continue;
        if (segmentHitsBox(a, b, node, endpoints.has(node.id) ? -0.02 : 0.06)) return false;
      }
      for (const group of groups) {
        if (group.bottom <= y && group.top >= y - 0.02 && segmentHitsBox(a, b, group, 0)) return false;
      }
    }
    return true;
  };

  const edges: SceneEdge[] = [];
  doc.edges.forEach((edge: DiagramEdge) => {
    const source = portWorld(edge.source.nodeId, edge.source.portId);
    const target = portWorld(edge.target.nodeId, edge.target.portId);
    if (!source || !target) return;
    for (const [end, info] of [[edge.source, source], [edge.target, target]] as const) {
      const key = `${end.nodeId}::${end.portId}`;
      if (!usedPorts.has(key)) {
        usedPorts.add(key);
        ports.push({ nodeId: end.nodeId, portId: end.portId, position: info.position });
      }
    }
    const p0 = source.position;
    const p5 = target.position;
    const p1 = { x: p0.x + source.normal.x * STUB, y: p0.y, z: p0.z + source.normal.y * STUB };
    const p4 = { x: p5.x + target.normal.x * STUB, y: p5.y, z: p5.z + target.normal.y * STUB };
    const lane = (hashString(edge.id) % 5) * 0.05;

    let points: Vec3[];
    let routing: SceneEdge['routing'];
    const sameLevel = Math.abs(p0.y - p5.y) < 1e-3;
    const endpoints = new Set([edge.source.nodeId, edge.target.nodeId]);
    const horizontalFirst = [p1, { x: p4.x, y: p1.y, z: p1.z }, p4];
    const verticalFirst = [p1, { x: p1.x, y: p1.y, z: p4.z }, p4];
    if (options.routeStyle === 'orthogonal' && sameLevel && flatPathClear(horizontalFirst, p0.y, endpoints)) {
      points = [p0, ...horizontalFirst, p5];
      routing = 'flat';
    } else if (options.routeStyle === 'orthogonal' && sameLevel && flatPathClear(verticalFirst, p0.y, endpoints)) {
      points = [p0, ...verticalFirst, p5];
      routing = 'flat';
    } else if (options.routeStyle === 'arc') {
      const cruise = Math.max(obstacleTop(p1, p4), p0.y, p5.y) + CLEARANCE + lane;
      const distance = Math.hypot(p4.x - p1.x, p4.z - p1.z);
      const lift = cruise + Math.min(1.2, distance * 0.18);
      const c1 = { x: p1.x + (p4.x - p1.x) * 0.12, y: lift, z: p1.z + (p4.z - p1.z) * 0.12 };
      const c2 = { x: p4.x + (p1.x - p4.x) * 0.12, y: lift, z: p4.z + (p1.z - p4.z) * 0.12 };
      const rise = { x: p1.x, y: p1.y + 0.12, z: p1.z };
      const fall = { x: p4.x, y: p4.y + 0.12, z: p4.z };
      const curve = Array.from({ length: 25 }, (_, index) => cubic(rise, c1, c2, fall, index / 24));
      points = [p0, p1, ...curve, p4, p5];
      routing = 'arc';
    } else {
      const cruise = Math.max(obstacleTop(p1, p4), p0.y, p5.y) + CLEARANCE + lane;
      points = [p0, p1, { ...p1, y: cruise }, { x: p4.x, y: cruise, z: p1.z }, { ...p4, y: cruise }, p4, p5];
      routing = 'elevated';
    }
    points = dedupe(points);
    edges.push({
      id: edge.id,
      relation: edge.relation,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.order !== undefined ? { order: edge.order } : {}),
      bidirectional: edge.direction === 'bidirectional',
      sourceId: edge.source.nodeId,
      targetId: edge.target.nodeId,
      points,
      labelAt: polylineMidpoint(points),
      routing,
    });
  });

  const all = [...nodes, ...groups];
  const min = { x: Infinity, y: 0, z: Infinity };
  const max = { x: -Infinity, y: 0.5, z: -Infinity };
  for (const box of all) {
    min.x = Math.min(min.x, box.x - box.sizeX / 2);
    max.x = Math.max(max.x, box.x + box.sizeX / 2);
    min.z = Math.min(min.z, box.z - box.sizeZ / 2);
    max.z = Math.max(max.z, box.z + box.sizeZ / 2);
    max.y = Math.max(max.y, box.top);
  }
  for (const edge of edges) for (const point of edge.points) max.y = Math.max(max.y, point.y);
  if (all.length === 0) {
    min.x = -4;
    min.z = -3;
    max.x = 4;
    max.z = 3;
  }

  return { groups, nodes, edges, ports, bounds: { min, max } };
}
