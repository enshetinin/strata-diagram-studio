/**
 * Orthogonal edge routing shared by the 2D editor and the SVG export, so a
 * manually bent relation looks identical in both.
 */
import { getSmoothStepPath, Position } from '@xyflow/system';
import type { DiagramEdge } from '../../domain/types';

export interface EdgeEnds {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

const horizontal = (position: Position) => position === Position.Left || position === Position.Right;

/**
 * Axis along which the middle segment can slide: `x` for left↔right ports,
 * `y` for top↔bottom. Other combinations route as an L or a U whose shape
 * React Flow derives from the ports alone, so they have no movable segment.
 */
export function bendAxis(ends: Pick<EdgeEnds, 'sourcePosition' | 'targetPosition'>): 'x' | 'y' | null {
  const source = horizontal(ends.sourcePosition);
  if (source !== horizontal(ends.targetPosition) || ends.sourcePosition === ends.targetPosition) return null;
  return source ? 'x' : 'y';
}

/** Returns `[path, labelX, labelY]` like React Flow's path helpers. */
export function strataEdgePath(ends: EdgeEnds, bend?: DiagramEdge['bend']): [string, number, number] {
  const axis = bend ? bendAxis(ends) : null;
  const centerX = (ends.sourceX + ends.targetX) / 2 + (axis === 'x' && bend ? bend.x : 0);
  const centerY = (ends.sourceY + ends.targetY) / 2 + (axis === 'y' && bend ? bend.y : 0);
  const [path, labelX, labelY] = getSmoothStepPath({
    ...ends,
    borderRadius: 10,
    offset: 20,
    ...(axis ? { centerX, centerY } : {}),
  });
  return [path, labelX, labelY];
}
