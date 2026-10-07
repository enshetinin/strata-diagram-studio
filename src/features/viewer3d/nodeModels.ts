/**
 * Node model kit: one designed miniature per node kind, in a shared
 * architectural language — a plinth, a bevelled ceramic body, translucent
 * glass layers tinted by the domain accent and small ink details.
 *
 * Every part of a node is merged into at most four geometries (one per
 * material role), so a node costs ≤ 4 draw calls however detailed it is.
 * Results are cached by (kind, footprint, height, bevel) and shared between
 * nodes of the same size.
 *
 * Local frame: origin at the centre of the node's base; +Y up. The camera
 * looks from +X/+Z, so faces with detail (screens, vents, LEDs) face +Z.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Path,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { NodeKind } from '../../domain/types';

export type ModelRole = 'body' | 'accent' | 'glass' | 'detail';
export const MODEL_ROLES: readonly ModelRole[] = ['body', 'accent', 'glass', 'detail'];
export type NodeModel = Partial<Record<ModelRole, BufferGeometry>>;

const PLINTH = 0.05;
const GAP = 0.018;

/** Collects parts per role, positioned in the node's local frame. */
class Kit {
  private readonly parts: Record<ModelRole, BufferGeometry[]> = { body: [], accent: [], glass: [], detail: [] };

  constructor(private readonly soft: boolean) {}

  private add(role: ModelRole, geometry: BufferGeometry) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    // Only the attributes every part shares survive the merge.
    for (const name of Object.keys(flat.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') flat.deleteAttribute(name);
    flat.clearGroups();
    this.parts[role].push(flat);
  }

  /** Box resting on `y`, centred on x/z; bevelled when the style is soft. */
  block(role: ModelRole, w: number, h: number, d: number, x = 0, y = 0, z = 0, radius = 0.03) {
    const r = this.soft ? Math.min(radius, Math.min(w, h, d) / 2 - 0.002) : 0;
    // Bevels below ~1 cm are invisible at diagram scale: plain boxes are far cheaper.
    const geometry = r >= 0.01 ? new RoundedBoxGeometry(w, h, d, 2, r) : new BoxGeometry(w, h, d);
    geometry.translate(x, y + h / 2, z);
    this.add(role, geometry);
  }

  cylinder(role: ModelRole, radiusTop: number, radiusBottom: number, h: number, x = 0, y = 0, z = 0, segments = 28) {
    this.add(role, new CylinderGeometry(radiusTop, radiusBottom, h, segments).translate(x, y + h / 2, z));
  }

  /** Surface of revolution from (radius, height) pairs, base at `y`. */
  lathe(role: ModelRole, profile: [number, number][], x = 0, y = 0, z = 0, segments = 28) {
    this.add(role, new LatheGeometry(profile.map(([r, py]) => new Vector2(Math.max(0, r), py)), segments).translate(x, y, z));
  }

  sphere(role: ModelRole, radius: number, x = 0, y = 0, z = 0) {
    this.add(role, new SphereGeometry(radius, 24, 16).translate(x, y, z));
  }

  torus(role: ModelRole, radius: number, tube: number, x: number, y: number, z: number, tiltX: number, tiltZ = 0) {
    this.add(role, new TorusGeometry(radius, tube, 8, 40).rotateX(tiltX).rotateZ(tiltZ).translate(x, y, z));
  }

  crystal(role: ModelRole, radius: number, x: number, y: number, z: number, detail = 0) {
    this.add(role, new IcosahedronGeometry(radius, detail).rotateY(0.4).translate(x, y, z));
  }

  /** Shape in the X/Y plane extruded `depth` along Z, standing upright, centred on z. */
  upright(role: ModelRole, shape: Shape, depth: number, x = 0, y = 0, z = 0) {
    const bevel = this.soft ? Math.min(0.012, depth / 4) : 0;
    const geometry = new ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
    geometry.translate(x, y, z - depth / 2 + bevel);
    this.add(role, geometry);
  }

  /** Shape in the X/Z plane (shape y → −z) extruded `height` upwards from `y`, turned `turn` about Y. */
  flat(role: ModelRole, shape: Shape, height: number, x = 0, y = 0, z = 0, turn = 0) {
    const bevel = this.soft ? Math.min(0.012, height / 4) : 0;
    const geometry = new ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
    geometry.rotateX(-Math.PI / 2).rotateY(turn).translate(x, y + bevel, z);
    this.add(role, geometry);
  }

  /** Low bevelled base that every model stands on. */
  plinth(w: number, d: number) {
    this.block('body', w, PLINTH, d, 0, 0, 0, 0.022);
  }

  /** Thin glass pad over the plinth: carries the domain colour for compact objects. */
  pad(w: number, d: number) {
    this.block('glass', w * 0.9, 0.022, d * 0.82, 0, PLINTH, 0, 0.01);
  }

  build(): NodeModel {
    const model: NodeModel = {};
    for (const role of MODEL_ROLES) {
      const list = this.parts[role];
      if (list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      for (const part of list) part.dispose();
      if (merged) {
        merged.computeBoundingSphere();
        model[role] = merged;
      }
    }
    return model;
  }
}

// ── Shapes ────────────────────────────────────────────────────────────────

/** Rounded-edge disc profile for lathes (radius r, height h, edge radius e). */
function discProfile(r: number, h: number, e: number): [number, number][] {
  const points: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 4; i += 1) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    points.push([r - e + Math.cos(a) * e, e + Math.sin(a) * e]);
  }
  for (let i = 0; i <= 4; i += 1) {
    const a = (i / 4) * (Math.PI / 2);
    points.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]);
  }
  points.push([0, h]);
  return points;
}

/** Hexagon stretched along X: half-length a, half-depth e. */
function longHexagon(a: number, e: number): Shape {
  const c = e * 0.62;
  const shape = new Shape();
  shape.moveTo(-a, 0);
  shape.lineTo(-a + c, e);
  shape.lineTo(a - c, e);
  shape.lineTo(a, 0);
  shape.lineTo(a - c, -e);
  shape.lineTo(-a + c, -e);
  shape.closePath();
  return shape;
}

function triangle(base: number, height: number): Shape {
  const shape = new Shape();
  shape.moveTo(-base / 2, 0);
  shape.lineTo(base / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return shape;
}

/** Lightning bolt (generic, from the 2D cache glyph), centred, size ≈ s. */
function bolt(s: number): Shape {
  const pts: [number, number][] = [
    [11, 2],
    [4, 11],
    [9, 11],
    [8, 18],
    [15, 9],
    [10, 9],
  ];
  const k = s / 16;
  const shape = new Shape();
  pts.forEach(([px, py], index) => {
    const x = (px - 9.5) * k;
    const y = -(py - 10) * k;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function gear(radius: number, teeth: number): Shape {
  const shape = new Shape();
  const inner = radius * 0.8;
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 4 === 1 || i % 4 === 2 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Path();
  hole.absarc(0, 0, radius * 0.32, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

/** Rectangle with a round-headed opening: a portal. */
function arch(width: number, height: number, openWidth: number, openHeight: number): Shape {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  shape.holes.push(archOpening(openWidth, openHeight));
  return shape;
}

function archOpening(openWidth: number, openHeight: number): Path {
  const r = openWidth / 2;
  const hole = new Path();
  hole.moveTo(-r, 0);
  hole.lineTo(-r, openHeight - r);
  hole.absarc(0, openHeight - r, r, Math.PI, 0, true);
  hole.lineTo(r, 0);
  hole.closePath();
  return hole;
}

function archPane(openWidth: number, openHeight: number): Shape {
  const r = openWidth / 2;
  const shape = new Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, openHeight - r);
  shape.absarc(0, openHeight - r, r, 0, Math.PI, false);
  shape.closePath();
  return shape;
}

/** Closed polygon from [x, y] points. */
function polygon(points: [number, number][]): Shape {
  const shape = new Shape();
  points.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

/** Rectangle centred on the origin. */
function rect(width: number, height: number): Shape {
  return polygon([
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ]);
}

function circle(radius: number): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  return shape;
}

/** Sheet of paper with a folded top-right corner (`fold` long), base at y = 0. */
function page(width: number, height: number, fold: number): Shape {
  return polygon([
    [-width / 2, 0],
    [width / 2, 0],
    [width / 2, height - fold],
    [width / 2 - fold, height],
    [-width / 2, height],
  ]);
}

/** Turned human figure, `s` tall (head included), standing on `base`. */
function figure(kit: Kit, x: number, base: number, z: number, s: number) {
  kit.lathe(
    'body',
    [
      [0, 0],
      [0.2 * s, 0],
      [0.21 * s, 0.03 * s],
      [0.17 * s, 0.08 * s],
      [0.13 * s, 0.34 * s],
      [0.15 * s, 0.46 * s],
      [0.14 * s, 0.52 * s],
      [0.09 * s, 0.56 * s],
      [0.05 * s, 0.6 * s],
      [0, 0.6 * s],
    ],
    x,
    base,
    z,
    32,
  );
  kit.sphere('accent', 0.15 * s, x, base + 0.78 * s, z);
}

/** Bar from (x1, z1) to (x2, z2) in plan, `width` wide and `height` tall, resting on `y`. */
function planBar(kit: Kit, role: ModelRole, x1: number, z1: number, x2: number, z2: number, width: number, height: number, y: number) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  if (length < 1e-3) return;
  // rotateY(θ) maps +X to (cos θ, −sin θ) in X/Z.
  kit.flat(role, rect(length, width), height, (x1 + x2) / 2, y, (z1 + z2) / 2, Math.atan2(-(z2 - z1), x2 - x1));
}

// ── Models by kind ───────────────────────────────────────────────────────

type Builder = (kit: Kit, w: number, d: number, h: number) => void;

const MODELS: Record<NodeKind, Builder> = {
  /** Server unit: ceramic block with vents and status LEDs, glass stratum on top. */
  service(kit, w, d, h) {
    kit.plinth(w, d);
    const bw = w * 0.88;
    const bd = d * 0.76;
    const bh = (h - PLINTH) * 0.74;
    kit.block('body', bw, bh, bd, 0, PLINTH);
    for (let i = 0; i < 3; i += 1) kit.block('detail', bw * 0.56, 0.012, 0.012, -bw * 0.12, PLINTH + bh * (0.28 + i * 0.2), bd / 2);
    for (let i = 0; i < 3; i += 1) kit.block('accent', 0.034, 0.034, 0.014, bw * 0.3 + i * 0.06, PLINTH + bh * 0.62, bd / 2, 0.008);
    kit.block('glass', bw, (h - PLINTH) * 0.2, bd, 0, PLINTH + bh + GAP);
  },

  /** Screen on a stand showing a stylised page; glass display. */
  frontend(kit, w, d, h) {
    kit.plinth(w, d);
    const sh = h - PLINTH - 0.05;
    const sw = w * 0.84;
    const sz = -d * 0.12;
    kit.block('body', w * 0.5, 0.03, d * 0.42, 0, PLINTH, sz + d * 0.02);
    kit.block('body', 0.08, 0.06, 0.05, 0, PLINTH + 0.02, sz);
    kit.block('body', sw, sh, 0.06, 0, PLINTH + 0.05, sz);
    const face = sz + 0.03;
    kit.block('glass', sw * 0.92, sh * 0.82, 0.016, 0, PLINTH + 0.05 + sh * 0.09, face);
    kit.block('accent', sw * 0.8, sh * 0.1, 0.012, 0, PLINTH + 0.05 + sh * 0.72, face + 0.012, 0.006);
    kit.block('detail', sw * 0.36, sh * 0.32, 0.01, -sw * 0.2, PLINTH + 0.05 + sh * 0.26, face + 0.012, 0.006);
    kit.block('detail', sw * 0.36, sh * 0.06, 0.01, sw * 0.2, PLINTH + 0.05 + sh * 0.52, face + 0.012, 0.004);
    kit.block('detail', sw * 0.36, sh * 0.06, 0.01, sw * 0.2, PLINTH + 0.05 + sh * 0.38, face + 0.012, 0.004);
    kit.block('detail', sw * 0.24, sh * 0.06, 0.01, sw * 0.14, PLINTH + 0.05 + sh * 0.24, face + 0.012, 0.004);
    kit.block('body', w * 0.6, 0.02, d * 0.22, 0, PLINTH, d * 0.26, 0.008);
  },

  /** Contract: elongated hexagonal prism with an accent band and glass lid. */
  api(kit, w, d, h) {
    kit.plinth(w, d);
    const a = w * 0.44;
    const e = d * 0.38;
    const bh = (h - PLINTH) * 0.68;
    kit.flat('body', longHexagon(a, e), bh * 0.46, 0, PLINTH);
    kit.flat('accent', longHexagon(a * 1.004, e * 1.01), 0.03, 0, PLINTH + bh * 0.46);
    kit.flat('body', longHexagon(a, e), bh * 0.5, 0, PLINTH + bh * 0.46 + 0.03);
    kit.flat('glass', longHexagon(a * 0.94, e * 0.9), (h - PLINTH) * 0.18, 0, PLINTH + bh + 0.03 + GAP);
    for (const side of [-1, 1]) kit.cylinder('detail', 0.026, 0.026, 0.04, side * (a + 0.01), PLINTH + bh * 0.2, 0, 20);
  },

  /** Ephemeral compute: low stage with a standing triangular prism. */
  function(kit, w, d, h) {
    kit.plinth(w, d);
    const sh = (h - PLINTH) * 0.3;
    kit.block('body', w * 0.84, sh, d * 0.72, 0, PLINTH);
    const th = h - PLINTH - sh - GAP;
    kit.upright('accent', triangle(th * 1.15, th), d * 0.34, -w * 0.12, PLINTH + sh + GAP, 0);
    kit.upright('glass', triangle(th * 0.95, th * 0.82), d * 0.5, w * 0.2, PLINTH + sh + GAP, 0);
    kit.block('detail', w * 0.2, 0.012, 0.012, w * 0.22, PLINTH + sh * 0.45, d * 0.36);
  },

  /** Stacked ceramic discs with glowing glass separators. */
  database(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const r = Math.min(d * 0.44, w * 0.3);
    const usable = h - PLINTH - 0.022;
    const ring = 0.026;
    const disc = (usable - ring * 2) / 3;
    let y = PLINTH + 0.022;
    for (let i = 0; i < 3; i += 1) {
      kit.lathe('body', discProfile(r, disc, Math.min(0.04, disc / 3)), 0, y);
      y += disc;
      if (i < 2) {
        kit.cylinder('glass', r * 0.97, r * 0.97, ring, 0, y);
        y += ring;
      }
    }
    kit.cylinder('accent', r * 0.42, r * 0.42, 0.012, 0, y);
    kit.block('detail', 0.05, 0.012, 0.012, r * 0.55, PLINTH + 0.022 + disc * 0.5, r * 0.78, 0.004);
  },

  /** Open tray holding upright glass files. */
  storage(kit, w, d, h) {
    kit.plinth(w, d);
    const tw = w * 0.86;
    const td = d * 0.78;
    const th = (h - PLINTH) * 0.62;
    const t = 0.035;
    kit.block('body', tw, t, td, 0, PLINTH);
    kit.block('body', tw, th, t, 0, PLINTH, td / 2 - t / 2, 0.012);
    kit.block('body', tw, th, t, 0, PLINTH, -td / 2 + t / 2, 0.012);
    kit.block('body', t, th, td, tw / 2 - t / 2, PLINTH, 0, 0.012);
    kit.block('body', t, th, td, -tw / 2 + t / 2, PLINTH, 0, 0.012);
    const files = 5;
    for (let i = 0; i < files; i += 1) {
      const x = -tw * 0.32 + (i * tw * 0.64) / (files - 1);
      const fh = (h - PLINTH - t) * (0.82 + 0.12 * Math.sin(i * 1.7));
      kit.block(i === 1 ? 'accent' : 'glass', 0.022, fh, td * 0.66, x, PLINTH + t, 0, 0.006);
    }
  },

  /** Message bus: a rail carrying a rhythm of thin glass slats. */
  queue(kit, w, d, h) {
    kit.plinth(w, d);
    const rw = w * 0.92;
    const rh = (h - PLINTH) * 0.26;
    kit.block('body', rw, rh, d * 0.4, 0, PLINTH);
    const count = Math.max(8, Math.min(22, Math.round(rw / 0.085)));
    const span = rw * 0.9;
    for (let i = 0; i < count; i += 1) {
      const x = -span / 2 + (i * span) / (count - 1);
      const wave = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin((i / (count - 1)) * Math.PI * 1.5 + 0.6));
      const sh = (h - PLINTH - rh) * wave;
      kit.block(i % 5 === 2 ? 'accent' : 'glass', 0.022, sh, d * 0.72, x, PLINTH + rh, 0, 0.006);
    }
    kit.block('detail', rw * 0.3, 0.012, 0.012, -rw * 0.25, PLINTH + rh * 0.5, d * 0.2);
  },

  /** Fast memory: low puck with a glass top and a raised bolt. */
  cache(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.5;
    kit.block('body', w * 0.82, bh, d * 0.74, 0, PLINTH, 0, 0.04);
    kit.block('glass', w * 0.82, (h - PLINTH) * 0.2, d * 0.74, 0, PLINTH + bh + GAP * 0.5, 0, 0.03);
    // Turned to face the default camera so the bolt reads at a glance.
    kit.flat('body', bolt(d * 0.82), (h - PLINTH) * 0.24, 0, PLINTH + bh + GAP * 0.5 + (h - PLINTH) * 0.2, 0, Math.PI / 4);
    for (let i = 0; i < 4; i += 1) kit.block('detail', 0.03, 0.012, 0.012, -w * 0.32 + i * 0.05, PLINTH + bh * 0.5, d * 0.37, 0.004);
  },

  /** Autonomous process: a glossy core on a column, circled by glass orbits. */
  agent(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const base = PLINTH + 0.022;
    const r = Math.min(d, w) * 0.42;
    kit.lathe('body', discProfile(r, 0.08, 0.03), 0, base);
    const core = Math.min(r * 0.52, (h - base) * 0.26);
    const column = h - base - 0.08 - core * 2.1;
    kit.cylinder('body', 0.04, 0.06, Math.max(0.04, column), 0, base + 0.08);
    const cy = h - core * 1.05;
    kit.sphere('accent', core, 0, cy, 0);
    kit.torus('glass', core * 1.7, 0.02, 0, cy, 0, Math.PI / 2 - 0.42, 0.3);
    kit.torus('glass', core * 1.5, 0.014, 0, cy, 0, Math.PI / 2 + 0.5, -0.5);
  },

  /** Model: a faceted glass crystal holding a glossy core, on a dish. */
  model(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const r = Math.min(d, w) * 0.44;
    kit.lathe(
      'body',
      [
        [0, 0],
        [r * 0.7, 0],
        [r, 0.05],
        [r * 0.92, 0.07],
        [r * 0.5, 0.06],
        [0, 0.06],
      ],
      0,
      PLINTH + 0.022,
    );
    const crystal = Math.min(r * 0.9, (h - PLINTH - 0.09) * 0.52);
    const cy = PLINTH + 0.082 + crystal * 0.95;
    kit.crystal('glass', crystal, 0, cy, 0);
    kit.sphere('accent', crystal * 0.42, 0, cy, 0);
  },

  /** Capability: a low chest carrying two meshing cogs laid flat, glass hubs. */
  tool(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.42;
    kit.block('body', w * 0.82, bh, d * 0.76, 0, PLINTH);
    kit.block('detail', w * 0.4, 0.012, 0.012, -w * 0.12, PLINTH + bh * 0.5, d * 0.38);
    const top = PLINTH + bh;
    const big = Math.min(d * 0.34, w * 0.2);
    const small = big * 0.62;
    const thick = Math.min(0.07, (h - top) * 0.4);
    const bx = -w * 0.08;
    const sx = bx + big + small * 0.82;
    kit.flat('accent', gear(big, 12), thick, bx, top, 0);
    kit.flat('glass', gear(small, 8), thick * 0.8, sx, top, -big * 0.25, 0.2);
    kit.cylinder('glass', big * 0.3, big * 0.3, h - top, bx, top, 0, 28);
    kit.cylinder('body', small * 0.3, small * 0.3, thick * 1.6, sx, top, -big * 0.25, 24);
  },

  /** Edge entry: a ceramic portal with a glass pane and accent keystone. */
  gateway(kit, w, d, h) {
    kit.plinth(w, d);
    const aw = w * 0.62;
    const ah = h - PLINTH - 0.02;
    const ow = aw * 0.52;
    const oh = ah * 0.74;
    const depth = d * 0.42;
    kit.upright('body', arch(aw, ah, ow, oh), depth, 0, PLINTH, 0);
    kit.upright('glass', archPane(ow * 0.98, oh * 0.98), 0.02, 0, PLINTH, 0);
    kit.block('accent', ow * 0.3, 0.03, depth * 1.02, 0, PLINTH + ah - 0.03, 0, 0.008);
    for (const side of [-1, 1]) kit.block('body', w * 0.16, (h - PLINTH) * 0.3, d * 0.5, side * (aw / 2 + w * 0.08), PLINTH);
  },

  /** Connected hardware: a chip with pins on a glass pad and an antenna. */
  device(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const base = PLINTH + 0.022;
    const cw = Math.min(w * 0.56, d * 0.68);
    const ch = (h - base) * 0.24;
    kit.block('body', cw, ch, cw, 0, base, 0, 0.02);
    for (let i = 0; i < 3; i += 1) {
      const offset = (i - 1) * cw * 0.28;
      kit.block('detail', 0.03, ch * 0.5, 0.06, offset, base + ch * 0.2, cw / 2 + 0.02, 0.004);
      kit.block('detail', 0.03, ch * 0.5, 0.06, offset, base + ch * 0.2, -cw / 2 - 0.02, 0.004);
      kit.block('detail', 0.06, ch * 0.5, 0.03, cw / 2 + 0.02, base + ch * 0.2, offset, 0.004);
      kit.block('detail', 0.06, ch * 0.5, 0.03, -cw / 2 - 0.02, base + ch * 0.2, offset, 0.004);
    }
    kit.block('glass', cw * 0.56, 0.03, cw * 0.56, 0, base + ch + GAP * 0.5, 0, 0.01);
    const top = base + ch;
    kit.cylinder('body', 0.012, 0.016, h - top - 0.06, cw * 0.32, top, -cw * 0.32, 12);
    kit.sphere('accent', 0.034, cw * 0.32, h - 0.034, -cw * 0.32);
  },

  /** Orchestrated steps: three ascending blocks joined by links, the last one lit. */
  workflow(kit, w, d, h) {
    kit.plinth(w, d);
    const sw = w * 0.22;
    const sd = d * 0.6;
    const cap = 0.03;
    const usable = h - PLINTH - cap - GAP;
    const steps = [0.38, 0.66, 0.94];
    steps.forEach((fraction, index) => {
      const x = (index - 1) * w * 0.3;
      const sh = usable * fraction;
      kit.block('body', sw, sh, sd, x, PLINTH);
      kit.block(index === steps.length - 1 ? 'accent' : 'glass', sw, cap, sd, x, PLINTH + sh + GAP, 0, 0.01);
      kit.block('detail', sw * 0.5, 0.012, 0.012, x, PLINTH + sh * 0.5, sd / 2);
      if (index < steps.length - 1) kit.block('detail', w * 0.08 + 0.02, 0.014, 0.014, x + w * 0.15, PLINTH + sh * 0.85, 0);
    });
  },

  /** Similarity search: a glass cube holding a scatter of points over a pedestal. */
  vector(kit, w, d, h) {
    kit.plinth(w, d);
    const ph = (h - PLINTH) * 0.16;
    kit.block('body', w * 0.78, ph, d * 0.72, 0, PLINTH);
    kit.block('detail', w * 0.36, 0.012, 0.012, -w * 0.14, PLINTH + ph * 0.5, d * 0.36);
    const base = PLINTH + ph + GAP;
    const gh = h - base;
    const cs = Math.min(w * 0.62, d * 0.66);
    kit.block('glass', cs, gh, cs, 0, base, 0, 0.02);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        // Fixed pseudo-random heights: a cloud, not a lattice.
        const lift = 0.5 + 0.5 * Math.sin(i * 2.3 + j * 4.1 + 0.7);
        kit.crystal((i + j) % 3 === 0 ? 'accent' : 'detail', 0.026, (i - 1) * cs * 0.28, base + gh * (0.2 + 0.6 * lift), (j - 1) * cs * 0.28);
      }
    }
  },

  /** Analytical store: three receding terraces split by glass strata. */
  warehouse(kit, w, d, h) {
    kit.plinth(w, d);
    const ring = 0.024;
    const level = (h - PLINTH - ring * 2 - 0.012) / 3;
    let y = PLINTH;
    for (let k = 0; k < 3; k += 1) {
      const lw = w * 0.88 * (1 - k * 0.2);
      const ld = d * 0.78 * (1 - k * 0.16);
      kit.block('body', lw, level, ld, 0, y);
      y += level;
      if (k < 2) {
        kit.block('glass', w * 0.88 * (1 - (k + 1) * 0.2), ring, d * 0.78 * (1 - (k + 1) * 0.16), 0, y, 0, 0.008);
        y += ring;
      }
    }
    kit.block('accent', w * 0.88 * 0.6 * 0.5, 0.012, d * 0.78 * 0.68 * 0.5, 0, y, 0, 0.004);
    for (let i = 0; i < 4; i += 1) kit.block('detail', w * 0.1, 0.012, 0.012, -w * 0.3 + i * w * 0.13, PLINTH + level * 0.5, d * 0.39);
  },

  /** Reference content: an upright page with a folded corner over glass sheets. */
  document(kit, w, d, h) {
    kit.plinth(w, d);
    const pw = Math.min(w * 0.5, (h - PLINTH) * 0.8);
    const ph = h - PLINTH - 0.02;
    const front = d * 0.12;
    kit.block('glass', pw, ph * 0.9, 0.02, -w * 0.14, PLINTH, front - d * 0.3, 0.006);
    kit.block('glass', pw, ph * 0.95, 0.02, -w * 0.07, PLINTH, front - d * 0.15, 0.006);
    const fold = pw * 0.24;
    kit.upright('body', page(pw, ph, fold), 0.03, w * 0.04, PLINTH, front);
    kit.upright(
      'accent',
      polygon([
        [pw / 2 - fold, ph - fold],
        [pw / 2, ph - fold],
        [pw / 2 - fold, ph],
      ]),
      0.012,
      w * 0.04,
      PLINTH,
      front + 0.021,
    );
    const lines = [0.62, 0.62, 0.62, 0.4];
    lines.forEach((fraction, index) => {
      const lw = pw * fraction;
      kit.block('detail', lw, 0.014, 0.008, w * 0.04 - pw * 0.42 + lw / 2, PLINTH + ph * (0.56 - index * 0.12), front + 0.019, 0.004);
    });
  },

  /** Ordered event log: parallel partitions carrying records, heads lit. */
  stream(kit, w, d, h) {
    kit.plinth(w, d);
    const rw = w * 0.92;
    const rh = (h - PLINTH) * 0.24;
    const rd = d * 0.18;
    const step = 0.085;
    const capacity = Math.max(4, Math.floor((rw - 0.06) / step));
    const lengths = [capacity, capacity - 2, capacity - 1];
    lengths.forEach((length, k) => {
      const z = (k - 1) * d * 0.27;
      kit.block('body', rw, rh, rd, 0, PLINTH, z, 0.012);
      for (let i = 0; i < length; i += 1) {
        const x = -rw / 2 + 0.05 + i * step;
        kit.block(i === length - 1 ? 'accent' : 'glass', 0.05, (h - PLINTH - rh - GAP) * 0.7, rd * 0.8, x, PLINTH + rh + GAP, z, 0.006);
      }
    });
  },

  /** Traffic distribution: a console whose hub fans out to three replicas. */
  balancer(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.46;
    kit.block('body', w * 0.86, bh, d * 0.76, 0, PLINTH);
    kit.block('detail', w * 0.4, 0.012, 0.012, -w * 0.14, PLINTH + bh * 0.5, d * 0.38);
    const top = PLINTH + bh;
    const hx = -w * 0.28;
    const hub = Math.min(w, d) * 0.1;
    kit.cylinder('accent', hub, hub, (h - top) * 0.7, hx, top, 0, 24);
    const reach = w * 0.5;
    // Narrow the fan on shallow nodes so the replicas stay on the plinth.
    const spread = Math.min(0.5, Math.asin(Math.min(1, (d * 0.34) / reach)));
    for (const angle of [-spread, 0, spread]) {
      const cx = Math.cos(angle);
      const cz = -Math.sin(angle);
      kit.flat('glass', rect(reach, 0.04), 0.03, hx + (cx * reach) / 2, top, (cz * reach) / 2, angle);
      kit.block('body', 0.08, (h - top) * 0.5, 0.08, hx + cx * reach, top, cz * reach, 0.02);
    }
  },

  /** Identity: a badge on a stand, portrait in accent, glass face. */
  identity(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', w * 0.52, 0.04, d * 0.42, 0, PLINTH, 0, 0.012);
    const cw = Math.min(w * 0.62, (h - PLINTH) * 0.9);
    const ch = h - PLINTH - 0.1;
    const z = -d * 0.04;
    const y = PLINTH + 0.04;
    kit.block('body', cw, ch, 0.05, 0, y, z, 0.02);
    kit.block('body', cw * 0.2, 0.05, 0.03, 0, y + ch, z, 0.01);
    const face = z + 0.025;
    kit.block('glass', cw * 0.9, ch * 0.86, 0.012, 0, y + ch * 0.07, face);
    kit.upright('accent', circle(Math.min(cw * 0.14, ch * 0.16)), 0.014, -cw * 0.2, y + ch * 0.58, face + 0.013);
    kit.block('accent', cw * 0.3, ch * 0.08, 0.012, -cw * 0.2, y + ch * 0.26, face + 0.012, 0.006);
    for (const fraction of [0.62, 0.48, 0.34]) kit.block('detail', cw * 0.3, 0.014, 0.008, cw * 0.2, y + ch * fraction, face + 0.012, 0.004);
  },

  /** Secrets: a safe with an accent dial, a handle and a glass lid. */
  secret(kit, w, d, h) {
    kit.plinth(w, d);
    const bw = w * 0.64;
    const bd = d * 0.7;
    const bh = (h - PLINTH) * 0.76;
    kit.block('body', bw, bh, bd, 0, PLINTH, 0, 0.03);
    kit.block('glass', bw, (h - PLINTH) * 0.18, bd, 0, PLINTH + bh + GAP, 0, 0.02);
    const face = bd / 2;
    const r = Math.min(bw, bh) * 0.2;
    kit.upright('accent', circle(r), 0.024, -bw * 0.1, PLINTH + bh * 0.5, face + 0.012);
    kit.upright('detail', circle(r * 0.32), 0.05, -bw * 0.1, PLINTH + bh * 0.5, face + 0.025);
    kit.block('detail', 0.03, bh * 0.36, 0.03, bw * 0.32, PLINTH + bh * 0.32, face + 0.015, 0.008);
    for (const fraction of [0.2, 0.7]) kit.block('body', 0.03, bh * 0.14, 0.04, -bw / 2 - 0.01, PLINTH + bh * fraction, face - 0.04, 0.008);
  },

  /** Telemetry: a console carrying a bar chart in glass and accent. */
  observability(kit, w, d, h) {
    kit.plinth(w, d);
    const ch = (h - PLINTH) * 0.24;
    kit.block('body', w * 0.86, ch, d * 0.72, 0, PLINTH);
    kit.block('detail', w * 0.5, ch * 0.4, 0.01, -w * 0.12, PLINTH + ch * 0.3, d * 0.36, 0.004);
    const bars = [0.38, 0.62, 0.48, 0.9, 0.72];
    const bw = w * 0.1;
    bars.forEach((fraction, index) => {
      const x = (index - (bars.length - 1) / 2) * bw * 1.45;
      const bh = (h - PLINTH - ch - GAP) * fraction;
      kit.block(index === 3 ? 'accent' : 'glass', bw, bh, d * 0.34, x, PLINTH + ch + GAP, -d * 0.04, 0.012);
    });
  },

  /** People: a small group of turned figures on a glass pad (one on narrow nodes). */
  client(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const base = PLINTH + 0.022;
    const fh = h - base;
    if (w > d * 1.5) {
      const step = Math.min(w * 0.26, fh * 0.55);
      figure(kit, -step, base, -d * 0.08, fh * 0.82);
      figure(kit, step, base, -d * 0.08, fh * 0.82);
      figure(kit, 0, base, d * 0.1, fh);
    } else {
      figure(kit, 0, base, 0, fh);
    }
  },

  /** Human in the loop: a figure beside a glass sheet carrying an accent tick. */
  human(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const base = PLINTH + 0.022;
    const fh = h - base;
    figure(kit, -Math.min(w * 0.16, 0.2), base, d * 0.04, fh);
    const pw = Math.min(w * 0.3, fh * 0.55);
    const ph = fh * 0.6;
    const px = Math.min(w * 0.2, 0.26);
    kit.block('glass', pw, ph, 0.02, px, base, -d * 0.06, 0.006);
    const c = pw * 0.36;
    kit.upright(
      'accent',
      polygon([
        [-0.5 * c, 0.05 * c],
        [-0.15 * c, -0.3 * c],
        [0.55 * c, 0.42 * c],
        [0.42 * c, 0.55 * c],
        [-0.15 * c, -0.04 * c],
        [-0.37 * c, 0.18 * c],
      ]),
      0.014,
      px,
      base + ph * 0.5,
      -d * 0.06 + 0.017,
    );
  },

  /** Phone standing on a dock: glass screen with a lit tile and list lines. */
  mobile(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', Math.min(w * 0.36, 0.4), 0.03, d * 0.4, 0, PLINTH, -d * 0.04, 0.01);
    const ph = h - PLINTH - 0.03;
    const pw = Math.min(ph * 0.52, w * 0.4);
    const z = -d * 0.06;
    const y = PLINTH + 0.03;
    kit.block('body', pw, ph, 0.045, 0, y, z, 0.03);
    const face = z + 0.0225;
    kit.block('glass', pw * 0.86, ph * 0.8, 0.012, 0, y + ph * 0.1, face);
    kit.block('accent', pw * 0.62, ph * 0.16, 0.01, 0, y + ph * 0.66, face + 0.01, 0.006);
    for (let i = 0; i < 3; i += 1) kit.block('detail', pw * (i === 2 ? 0.4 : 0.62), 0.012, 0.008, 0, y + ph * (0.5 - i * 0.1), face + 0.01, 0.004);
    kit.block('detail', pw * 0.24, 0.012, 0.008, 0, y + ph * 0.04, face, 0.004);
  },

  /** Shipping container: ribbed body, door bars in accent, glass roof. */
  container(kit, w, d, h) {
    kit.plinth(w, d);
    const bw = w * 0.86;
    const bd = d * 0.62;
    const bh = (h - PLINTH) * 0.72;
    kit.block('body', bw, bh, bd, 0, PLINTH, 0, 0.015);
    const ribs = Math.max(4, Math.floor((bw * 0.8) / 0.09));
    for (let i = 0; i < ribs; i += 1) {
      const x = -bw * 0.42 + (i * bw * 0.72) / (ribs - 1);
      kit.block('glass', 0.014, bh * 0.8, 0.01, x, PLINTH + bh * 0.1, bd / 2 + 0.004);
    }
    for (const offset of [0.03, 0.07]) kit.block('accent', 0.014, bh * 0.8, 0.012, bw / 2 - offset, PLINTH + bh * 0.1, bd / 2 + 0.005, 0.004);
    kit.block('glass', bw, (h - PLINTH) * 0.2, bd, 0, PLINTH + bh + GAP, 0, 0.012);
  },

  /** Virtual machines: three rack units with status LEDs under a glass cap. */
  vm(kit, w, d, h) {
    kit.plinth(w, d);
    const bw = w * 0.84;
    const bd = d * 0.72;
    const gap = 0.02;
    const unit = ((h - PLINTH) * 0.84 - gap * 2) / 3;
    for (let i = 0; i < 3; i += 1) {
      const y = PLINTH + i * (unit + gap);
      kit.block('body', bw, unit, bd, 0, y, 0, 0.012);
      kit.block('detail', bw * 0.46, 0.012, 0.01, -bw * 0.16, y + unit * 0.45, bd / 2, 0.004);
      kit.block('accent', 0.03, 0.03, 0.012, bw * 0.36, y + unit * 0.35, bd / 2, 0.006);
    }
    kit.block('glass', bw, (h - PLINTH) * 0.1, bd, 0, PLINTH + 3 * unit + 2 * gap + GAP, 0, 0.01);
  },

  /** Scheduler: an upright clock dial with ink hands and an accent pivot. */
  scheduler(kit, w, d, h) {
    kit.plinth(w, d);
    const r = Math.min(d * 0.36, w * 0.3);
    kit.lathe('body', discProfile(r, 0.05, 0.02), 0, PLINTH);
    const dial = Math.min((h - PLINTH - 0.05) / 2 - 0.005, w * 0.36);
    const cy = PLINTH + 0.05 + dial;
    kit.upright('body', circle(dial), 0.06, 0, cy, 0);
    kit.upright('glass', circle(dial * 0.86), 0.012, 0, cy, 0.036);
    kit.block('detail', 0.016, dial * 0.62, 0.01, 0, cy, 0.047, 0.004);
    kit.block('detail', dial * 0.45, 0.016, 0.01, dial * 0.225, cy - 0.008, 0.047, 0.004);
    kit.upright('accent', circle(0.026), 0.02, 0, cy, 0.05);
  },

  /** Search: a magnifying lens leaning over an index block. */
  search(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.22;
    kit.block('body', w * 0.72, bh, d * 0.6, 0, PLINTH);
    for (let i = 0; i < 3; i += 1) kit.block('detail', w * (0.4 - i * 0.08), 0.012, 0.01, -w * 0.12, PLINTH + bh * (0.3 + i * 0.22), d * 0.3, 0.004);
    const top = PLINTH + bh;
    const tube = 0.03;
    const ring = Math.min((h - top) * 0.34, w * 0.2);
    const lx = -w * 0.06;
    const ly = h - ring - tube;
    kit.torus('body', ring, tube, lx, ly, 0, 0);
    kit.upright('glass', circle(ring * 0.96), 0.014, lx, ly, 0);
    const dir = Math.SQRT1_2;
    const sx = lx + (ring + tube) * dir;
    const sy = ly - (ring + tube) * dir;
    const length = Math.max(0.04, Math.min((sy - top) / dir, ring * 1.2));
    const ex = sx + length * dir;
    const ey = sy - length * dir;
    const t = 0.028;
    kit.upright(
      'accent',
      polygon([
        [sx - t * dir, sy - t * dir],
        [ex - t * dir, ey - t * dir],
        [ex + t * dir, ey + t * dir],
        [sx + t * dir, sy + t * dir],
      ]),
      0.04,
      0,
      0,
      0,
    );
  },

  /** Registry: a shelf frame holding versioned boxes, one lit. */
  registry(kit, w, d, h) {
    kit.plinth(w, d);
    const sw = w * 0.8;
    const sd = d * 0.6;
    const sh = h - PLINTH;
    const t = 0.03;
    for (const side of [-1, 1]) kit.block('body', t, sh, sd, side * (sw / 2 - t / 2), PLINTH, 0, 0.008);
    const middle = PLINTH + sh * 0.46;
    for (const y of [PLINTH, middle, h - t]) kit.block('body', sw, t, sd, 0, y, 0, 0.008);
    const box = Math.min(sd * 0.62, (sh * 0.46 - t) * 0.78, (h - t - middle - t) * 0.78);
    const inner = sw - t * 2;
    [-0.3, 0, 0.3].forEach((f, i) => kit.block(i === 2 ? 'accent' : 'glass', box, box, box, f * inner, PLINTH + t, 0, 0.01));
    [-0.22, 0.12].forEach((f) => kit.block('glass', box, box * 0.8, box, f * inner, middle + t, 0, 0.01));
  },

  /** Repository: a commit graph — main line and a lit branch — over a slab. */
  repo(kit, w, d, h) {
    kit.plinth(w, d);
    const sh = (h - PLINTH) * 0.32;
    kit.block('body', w * 0.84, sh, d * 0.7, 0, PLINTH);
    const top = PLINTH + sh;
    const r = Math.min(0.05, (h - top) * 0.32);
    const y = h - r;
    const zMain = d * 0.12;
    const zBranch = -d * 0.18;
    const xs = [-w * 0.3, 0, w * 0.3];
    kit.block('detail', w * 0.6, 0.02, 0.02, 0, y - 0.01, zMain);
    kit.block('detail', 0.02, 0.02, zMain - zBranch, 0, y - 0.01, (zMain + zBranch) / 2);
    kit.block('detail', w * 0.15, 0.02, 0.02, w * 0.075, y - 0.01, zBranch);
    for (const x of xs) {
      kit.sphere('body', r, x, y, zMain);
      kit.cylinder('glass', 0.012, 0.012, y - top, x, top, zMain, 10);
    }
    kit.sphere('accent', r, w * 0.15, y, zBranch);
    kit.cylinder('glass', 0.012, 0.012, y - top, w * 0.15, top, zBranch, 10);
  },

  /** Notification: an upright envelope with a glass flap and an accent badge. */
  notification(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', w * 0.5, 0.03, d * 0.4, 0, PLINTH, 0, 0.01);
    const y = PLINTH + 0.03;
    const badge = Math.min(0.06, w * 0.08);
    const eh = Math.min(h - y - badge * 1.6, w * 0.4);
    const ew = Math.min(w * 0.62, eh * 1.6);
    kit.block('body', ew, eh, 0.04, 0, y, 0, 0.012);
    kit.upright(
      'glass',
      polygon([
        [-ew / 2, eh],
        [0, eh * 0.38],
        [ew / 2, eh],
      ]),
      0.012,
      0,
      y,
      0.026,
    );
    kit.sphere('accent', badge, ew / 2 - badge * 0.2, Math.min(y + eh + badge * 0.3, h - badge), 0.02);
  },

  /** Guardrail: posts and rails with a glass panel; the top rail lit. */
  guardrail(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', w * 0.82, 0.03, d * 0.4, 0, PLINTH, 0, 0.01);
    const y = PLINTH + 0.03;
    const ph = h - y;
    for (const f of [-0.36, 0, 0.36]) kit.cylinder('body', 0.026, 0.03, ph, f * w, y, 0, 16);
    kit.block('accent', w * 0.78, 0.036, 0.034, 0, h - 0.06, 0, 0.01);
    kit.block('detail', w * 0.74, 0.02, 0.02, 0, y + ph * 0.5, 0, 0.006);
    kit.block('glass', w * 0.7, ph * 0.38, 0.012, 0, y + ph * 0.06, 0);
  },

  /** Notebook: an open book — two raised pages over a glass cover, ribbon in accent. */
  notebook(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', w * 0.8, 0.03, d * 0.7, 0, PLINTH, 0, 0.01);
    const y = PLINTH + 0.03;
    const pw = w * 0.36;
    const t = 0.024;
    const rise = Math.min(pw * 0.5, h - y - t - 0.01);
    const depth = d * 0.6;
    const page = (side: number, extra: number, lift: number) =>
      polygon(
        side < 0
          ? [
              [0, lift],
              [-(pw + extra), rise + lift],
              [-(pw + extra), rise + lift + t],
              [0, lift + t],
            ]
          : [
              [0, lift],
              [0, lift + t],
              [pw + extra, rise + lift + t],
              [pw + extra, rise + lift],
            ],
      );
    for (const side of [-1, 1]) {
      kit.upright('glass', page(side, 0.02, 0), depth * 1.04, 0, y, 0);
      kit.upright('body', page(side, 0, t), depth, 0, y, 0);
    }
    kit.block('accent', 0.03, t * 2 + 0.01, 0.012, w * 0.06, y, depth / 2 + 0.01, 0.004);
  },

  /** CDN: a central hub linked to four edge pucks. */
  cdn(kit, w, d, h) {
    kit.plinth(w, d);
    kit.pad(w, d);
    const base = PLINTH + 0.022;
    const r = Math.min(w, d) * 0.2;
    const ch = (h - base) * 0.62;
    kit.lathe('body', discProfile(r, ch, Math.min(0.04, ch / 3)), 0, base);
    kit.cylinder('accent', r * 0.4, r * 0.4, h - base - ch, 0, base + ch, 0, 24);
    const sat = Math.min(0.06, d * 0.1);
    for (const [sx, sz] of [
      [-0.36, -0.3],
      [0.36, -0.3],
      [-0.36, 0.3],
      [0.36, 0.3],
    ] as const) {
      const x = sx * w;
      const z = sz * d;
      kit.cylinder('glass', sat, sat, (h - base) * 0.32, x, base, z, 20);
      const dist = Math.hypot(x, z);
      const ux = x / dist;
      const uz = z / dist;
      planBar(kit, 'detail', ux * r, uz * r, x - ux * sat, z - uz * sat, 0.016, 0.016, base + 0.03);
    }
  },

  /** DNS: a signpost with two arrow boards pointing opposite ways. */
  dns(kit, w, d, h) {
    kit.plinth(w, d);
    kit.block('body', 0.16, 0.04, 0.16, 0, PLINTH, 0, 0.012);
    kit.cylinder('body', 0.02, 0.022, h - PLINTH - 0.04, 0, PLINTH + 0.04, 0, 16);
    const bh = (h - PLINTH) * 0.18;
    const length = Math.min(w * 0.4, 0.5);
    const outline: [number, number][] = [
      [0, -bh / 2],
      [length - bh / 2, -bh / 2],
      [length, 0],
      [length - bh / 2, bh / 2],
      [0, bh / 2],
    ];
    const arrow = (dir: number) => polygon(outline.map(([x, y]) => [x * dir, y]));
    kit.upright('accent', arrow(1), 0.03, 0.025, h - bh * 0.7, 0.03);
    kit.upright('glass', arrow(-1), 0.03, -0.025, h - bh * 2.1, 0.03);
  },

  /** Firewall: a brick wall with one lit brick (an open port) and a glass coping. */
  firewall(kit, w, d, h) {
    kit.plinth(w, d);
    const lw = w * 0.86;
    const t = d * 0.32;
    const wh = (h - PLINTH) * 0.78;
    const rows = 4;
    const rh = wh / rows;
    const count = Math.max(3, Math.round(lw / 0.18));
    const bw = lw / count;
    const mortar = 0.012;
    for (let row = 0; row < rows; row += 1) {
      const y = PLINTH + row * rh;
      // Odd rows start half a brick in: running bond.
      const edges = row % 2 === 0 ? Array.from({ length: count + 1 }, (_, i) => -lw / 2 + i * bw) : [-lw / 2, ...Array.from({ length: count }, (_, i) => -lw / 2 + bw / 2 + i * bw), lw / 2];
      for (let i = 0; i < edges.length - 1; i += 1) {
        const x0 = edges[i] ?? 0;
        const x1 = edges[i + 1] ?? 0;
        const lit = row === 1 && i === Math.floor(edges.length / 2);
        kit.block(lit ? 'accent' : 'body', x1 - x0 - mortar, rh - mortar, t, (x0 + x1) / 2, y, 0, 0.008);
      }
    }
    kit.block('glass', lw, (h - PLINTH) * 0.14, t * 1.1, 0, PLINTH + wh + GAP, 0, 0.01);
  },

  /** Third party: a sealed block behind a dashed fence of posts — outside your boundary. */
  external(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.58;
    kit.block('body', w * 0.54, bh, d * 0.5, 0, PLINTH, 0, 0.05);
    kit.block('glass', w * 0.54, (h - PLINTH) * 0.22, d * 0.5, 0, PLINTH + bh + GAP, 0, 0.04);
    kit.block('accent', 0.04, 0.04, 0.014, w * 0.2, PLINTH + bh * 0.55, d * 0.25, 0.008);
    const fw = w * 0.86;
    const fd = d * 0.82;
    const post = (h - PLINTH) * 0.26;
    const spacing = 0.15;
    // Posts only, no rails: a dashed outline in three dimensions.
    for (let x = -fw / 2; x <= fw / 2 + 1e-6; x += fw / Math.max(2, Math.round(fw / spacing))) {
      kit.block('glass', 0.024, post, 0.024, x, PLINTH, fd / 2, 0.006);
      kit.block('glass', 0.024, post, 0.024, x, PLINTH, -fd / 2, 0.006);
    }
    const sideSteps = Math.max(2, Math.round(fd / spacing));
    for (let i = 1; i < sideSteps; i += 1) {
      const z = -fd / 2 + (i * fd) / sideSteps;
      kit.block('glass', 0.024, post, 0.024, fw / 2, PLINTH, z, 0.006);
      kit.block('glass', 0.024, post, 0.024, -fw / 2, PLINTH, z, 0.006);
    }
  },

  /** Unclassified: a bevelled block under a glass stratum. */
  generic(kit, w, d, h) {
    kit.plinth(w, d);
    const bh = (h - PLINTH) * 0.66;
    kit.block('body', w * 0.8, bh, d * 0.7, 0, PLINTH, 0, 0.05);
    kit.block('glass', w * 0.8, (h - PLINTH) * 0.24, d * 0.7, 0, PLINTH + bh + GAP, 0, 0.04);
    kit.block('accent', 0.04, 0.04, 0.014, w * 0.32, PLINTH + bh * 0.55, d * 0.35, 0.008);
  },
};

const cache = new Map<string, NodeModel>();

/** Merged geometries for a node of kind `kind`, footprint `w × d` and height `h`. */
export function nodeModel(kind: NodeKind, w: number, d: number, h: number, soft: boolean): NodeModel {
  const key = `${kind}|${w.toFixed(2)}|${d.toFixed(2)}|${h.toFixed(2)}|${soft ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const kit = new Kit(soft);
  MODELS[kind](kit, w, d, h);
  const model = kit.build();
  cache.set(key, model);
  return model;
}
