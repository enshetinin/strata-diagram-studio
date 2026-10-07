/**
 * Shared unit geometries (1×1×1, centred) for platforms and other scaled
 * primitives. Created once and reused. Node models live in `nodeModels.ts`.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type GeometryKey =
  | 'box'
  | 'rounded'
  | 'hex'
  | 'cylinder'
  | 'octagon'
  | 'cone'
  | 'sphere'
  | 'icosa'
  | 'octa'
  | 'pyramid'
  | 'frustum';

const cache = new Map<string, BufferGeometry>();

/** Unit-sized shared geometry (1×1×1 bounding box, centred). */
export function unitGeometry(key: GeometryKey): BufferGeometry {
  let geometry = cache.get(key);
  if (geometry) return geometry;
  switch (key) {
    case 'box':
      geometry = new BoxGeometry(1, 1, 1);
      break;
    case 'rounded':
      geometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.08);
      break;
    case 'hex':
      geometry = new CylinderGeometry(0.5, 0.5, 1, 6);
      break;
    case 'cylinder':
      geometry = new CylinderGeometry(0.5, 0.5, 1, 32);
      break;
    case 'octagon':
      geometry = new CylinderGeometry(0.5, 0.5, 1, 8);
      break;
    case 'cone':
      geometry = new ConeGeometry(0.5, 1, 24);
      break;
    case 'sphere':
      geometry = new SphereGeometry(0.5, 24, 16);
      break;
    case 'icosa':
      geometry = new IcosahedronGeometry(0.5, 0);
      break;
    case 'octa':
      geometry = new OctahedronGeometry(0.5, 0);
      break;
    case 'pyramid':
      geometry = new ConeGeometry(0.5, 1, 4);
      break;
    case 'frustum':
      // Axis-aligned tapered block (unit square top, smaller bottom): island undersides.
      geometry = new CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 0.55, 1, 4, 1).rotateY(Math.PI / 4);
      break;
  }
  cache.set(key, geometry);
  return geometry;
}
