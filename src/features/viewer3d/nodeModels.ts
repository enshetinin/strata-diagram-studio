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
    const figure = (x: number, z: number, scale: number) => {
      const s = fh * scale;
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
    };
    if (w > d * 1.5) {
      const step = Math.min(w * 0.26, fh * 0.55);
      figure(-step, -d * 0.08, 0.82);
      figure(step, -d * 0.08, 0.82);
      figure(0, d * 0.1, 1);
    } else {
      figure(0, 0, 1);
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
