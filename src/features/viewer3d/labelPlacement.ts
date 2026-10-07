/**
 * Places group titles along each platform's header strip so that titles of
 * nested platforms (which project to nearly the same screen spot once lifted)
 * do not overlap. Deterministic and computed in camera space for the preset
 * view direction.
 */
import { OrthographicCamera, Vector3 } from 'three';
import type { SceneEdge, SceneGroup, SceneNode } from '../layout/sceneModel';

export interface TitlePlacement {
  position: [number, number, number];
  /** Camera-space footprint, so node labels can yield to the title. */
  rect: ScreenRect;
}

export interface ScreenRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const overlaps = (a: ScreenRect, b: ScreenRect, gap: number) => a.minX < b.maxX + gap && b.minX < a.maxX + gap && a.minY < b.maxY + gap && b.minY < a.maxY + gap;

/** Group title font size: top-level platforms read slightly larger. */
export const titleSize = (labelSize: number, group: SceneGroup) => Math.min(0.5, labelSize * (group.depth === 0 ? 1.05 : 0.95));

/** Approximate text width for the uppercase bold title font. */
export function titleWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.68;
}

/** Screen footprint of a billboard node label (anchored bottom-centre above the block). */
function nodeLabelRect(node: SceneNode, size: number, toScreen: (point: Vector3) => Vector3): ScreenRect {
  const anchor = toScreen(new Vector3(node.x, node.top + 0.08, node.z));
  const maxWidth = Math.max(2, node.sizeX * 1.2);
  const raw = node.label.length * size * 0.55;
  const width = Math.min(raw, maxWidth);
  const lines = Math.ceil(raw / maxWidth);
  return { minX: anchor.x - width / 2, maxX: anchor.x + width / 2, minY: anchor.y, maxY: anchor.y + lines * size * 1.15 };
}

/** Screen footprint of a walkthrough number drawn on a relation. */
function orderMarkerRect(edge: SceneEdge, size: number, toScreen: (point: Vector3) => Vector3): ScreenRect | null {
  if (edge.order === undefined) return null;
  const anchor = toScreen(new Vector3(edge.labelAt.x, edge.labelAt.y + 0.05, edge.labelAt.z));
  const width = String(edge.order).length * size * 0.8 * 0.6 + size * 0.3;
  return { minX: anchor.x - width / 2, maxX: anchor.x + width / 2, minY: anchor.y, maxY: anchor.y + size * 0.9 };
}

/** Camera-space projection for the preset view direction (orthographic, so zoom-independent). */
function projector(direction: Vector3) {
  const probe = new OrthographicCamera();
  probe.position.copy(direction).multiplyScalar(50);
  probe.lookAt(0, 0, 0);
  probe.updateMatrixWorld();
  return (point: Vector3) => point.applyMatrix4(probe.matrixWorldInverse);
}

/**
 * Drops node labels that would overlap one already kept, walking `ranked`
 * (most important first) or a `blocked` area such as a group title. `keep`
 * ids are always drawn. Returns the ids whose labels stay visible.
 */
export function declutterNodeLabels(ranked: SceneNode[], keep: Set<string>, direction: Vector3, labelSize: number, blocked: ScreenRect[] = []): Set<string> {
  const toScreen = projector(direction);
  const placed: ScreenRect[] = [...blocked];
  const visible = new Set<string>();
  const gap = labelSize * 0.1;
  const ordered = [...ranked.filter((node) => keep.has(node.id)), ...ranked.filter((node) => !keep.has(node.id))];
  for (const node of ordered) {
    const rect = nodeLabelRect(node, labelSize, toScreen);
    if (!keep.has(node.id) && placed.some((other) => overlaps(rect, other, gap))) continue;
    placed.push(rect);
    visible.add(node.id);
  }
  return visible;
}

/** True when an edge's walkthrough number would sit on one of `blocked`. */
export function markerCollides(edge: SceneEdge, direction: Vector3, labelSize: number, blocked: ScreenRect[]): boolean {
  const rect = orderMarkerRect(edge, labelSize, projector(direction));
  return rect !== null && blocked.some((other) => overlaps(rect, other, 0));
}

export function placeGroupTitles(
  groups: SceneGroup[],
  nodes: SceneNode[],
  direction: Vector3,
  labelSize: number,
  fontSizeFor: (group: SceneGroup) => number,
  edges: SceneEdge[] = [],
): Map<string, TitlePlacement> {
  const toScreen = projector(direction);

  const obstacles: ScreenRect[] = [
    ...nodes.map((node) => nodeLabelRect(node, labelSize, toScreen)),
    ...edges.flatMap((edge) => orderMarkerRect(edge, labelSize, toScreen) ?? []),
  ];
  const placed: ScreenRect[] = [];
  const result = new Map<string, TitlePlacement>();
  const ordered = [...groups].sort((a, b) => a.depth - b.depth || a.z - b.z || a.x - b.x);
  for (const group of ordered) {
    const size = fontSizeFor(group);
    const width = titleWidth(group.label, size);
    const minX = group.x - group.sizeX / 2;
    const minZ = group.z - group.sizeZ / 2;
    const y = group.top + 0.02;
    const z = minZ + 0.3;
    const room = Math.max(0, group.sizeX - 0.6 - width * 0.6);
    const candidates: [number, number, number][] = [];
    for (let index = 0; index <= Math.floor(room / 0.5); index += 1) candidates.push([minX + 0.28 + index * 0.5, y, z]);
    // Fallback: lift the title above the platform's far corner.
    for (let lift = 1; lift <= 4; lift += 1) candidates.push([minX + 0.15, y + lift * size * 1.3, minZ + 0.15]);
    let chosen: { position: [number, number, number]; rect: ScreenRect } | null = null;
    for (const position of candidates) {
      const anchor = toScreen(new Vector3(...position));
      const rect = { minX: anchor.x, maxX: anchor.x + width, minY: anchor.y - size * 0.6, maxY: anchor.y + size * 0.6 };
      chosen ??= { position, rect };
      const gap = size * 0.2;
      if (!placed.some((other) => overlaps(rect, other, gap)) && !obstacles.some((other) => overlaps(rect, other, gap))) {
        chosen = { position, rect };
        break;
      }
    }
    if (chosen) {
      placed.push(chosen.rect);
      result.set(group.id, chosen);
    }
  }
  return result;
}
