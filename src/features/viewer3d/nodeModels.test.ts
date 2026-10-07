import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { KIND_INFO } from '../../domain/catalog';
import { DEFAULT_NODE_SIZE, NODE_KINDS } from '../../domain/types';
import { WORLD_SCALE } from '../layout/sceneModel';
import { MODEL_ROLES, nodeModel } from './nodeModels';

const FOOTPRINTS = [
  { w: DEFAULT_NODE_SIZE.width * WORLD_SCALE, d: DEFAULT_NODE_SIZE.height * WORLD_SCALE },
  { w: 1, d: 1 },
];
// Bevels and the extruded-shape bevel may poke a hair past the nominal box.
const TOLERANCE = 0.02;

describe('3D node models', () => {
  for (const kind of NODE_KINDS) {
    it(`${kind} stays inside its footprint and height`, () => {
      for (const soft of [true, false]) {
        for (const { w, d } of FOOTPRINTS) {
          const h = KIND_INFO[kind].height;
          const model = nodeModel(kind, w, d, h, soft);
          expect(model.body).toBeDefined();
          const bounds = new Box3();
          for (const role of MODEL_ROLES) {
            const geometry = model[role];
            if (!geometry) continue;
            geometry.computeBoundingBox();
            if (geometry.boundingBox) bounds.union(geometry.boundingBox);
          }
          expect(bounds.min.y).toBeGreaterThanOrEqual(-TOLERANCE);
          expect(bounds.max.y).toBeLessThanOrEqual(h + TOLERANCE);
          expect(Math.max(-bounds.min.x, bounds.max.x)).toBeLessThanOrEqual(w / 2 + TOLERANCE);
          expect(Math.max(-bounds.min.z, bounds.max.z)).toBeLessThanOrEqual(d / 2 + TOLERANCE);
        }
      }
    });
  }
});
