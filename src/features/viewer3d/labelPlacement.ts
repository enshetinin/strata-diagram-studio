/**
 * Places group titles along each platform's header strip so that titles of
 * nested platforms (which project to nearly the same screen spot once lifted)
 * do not overlap. Deterministic and computed in camera space for the preset
 * view direction.
 */
import { OrthographicCamera, Vector3 } from 'three';
import type { SceneGroup, SceneNode } from '../layout/sceneModel';

export interface TitlePlacement {
  position: [number, number, number];
}

interface ScreenRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const overlaps = (a: ScreenRect, b: ScreenRect, gap: number) => a.minX < b.maxX + gap && b.minX < a.maxX + gap && a.minY < b.maxY + gap && b.minY < a.maxY + gap;

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

export function placeGroupTitles(groups: SceneGroup[], nodes: SceneNode[], direction: Vector3, labelSize: number, fontSizeFor: (group: SceneGroup) => number): Map<string, TitlePlacement> {
  const probe = new OrthographicCamera();
  probe.position.copy(direction).multiplyScalar(50);
  probe.lookAt(0, 0, 0);
  probe.updateMatrixWorld();
  const toScreen = (point: Vector3) => point.applyMatrix4(probe.matrixWorldInverse);

  const obstacles: ScreenRect[] = nodes.map((node) => nodeLabelRect(node, labelSize, toScreen));
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
      result.set(group.id, { position: chosen.position });
    }
  }
  return result;
}
