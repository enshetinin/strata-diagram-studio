/**
 * Small authoring DSL used by templates and the rule-based generator.
 *
 * Nodes are placed on an absolute grid (fractional cells allowed). Group
 * rectangles are derived bottom-up from their descendants plus padding, and
 * everything is finally stored in group-local coordinates as the canonical
 * layout requires.
 */
import { defaultPorts } from '../../domain/commands';
import { GROUP_PADDING, unionRects } from '../../domain/geometry';
import { deriveNarrative } from '../../domain/narrative';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_NODE_SIZE,
  SCHEMA_VERSION,
  type AppearanceSettings,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type EdgeDirection,
  type GroupKind,
  type JsonObject,
  type NodeKind,
  type PortSide,
  type Rect,
  type RelationKind,
  type StyleId,
} from '../../domain/types';

export const CELL = { width: 232, height: 152 } as const;

interface NodeOptions {
  group?: string;
  provider?: string;
  description?: string;
  metadata?: JsonObject;
  size?: { width: number; height: number };
}

interface EdgeOptions {
  order?: number;
  explanation?: string;
  direction?: EdgeDirection;
  fromSide?: PortSide;
  toSide?: PortSide;
}

interface GroupOptions {
  kind?: GroupKind;
  parent?: string;
  description?: string;
}

const OPPOSITE: Record<PortSide, PortSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

export class DiagramBuilder {
  private readonly groups: DiagramGroup[] = [];
  private readonly nodes: DiagramNode[] = [];
  private readonly edges: DiagramEdge[] = [];
  private readonly absolute = new Map<string, Rect>();
  private readonly ids = new Set<string>();

  constructor(
    private readonly meta: {
      id: string;
      name: string;
      description: string;
      styleId: StyleId;
      appearance?: Partial<AppearanceSettings>;
    },
  ) {}

  private claim(id: string): void {
    if (this.ids.has(id)) throw new Error(`Template ${this.meta.id}: duplicate id ${id}`);
    this.ids.add(id);
  }

  group(id: string, label: string, options: GroupOptions = {}): this {
    this.claim(id);
    this.groups.push({
      id,
      label,
      kind: options.kind ?? 'domain',
      parentGroupId: options.parent ?? null,
      ...(options.description ? { description: options.description } : {}),
    });
    return this;
  }

  node(id: string, kind: NodeKind, label: string, cell: [number, number], options: NodeOptions = {}): this {
    this.claim(id);
    const size = options.size ?? DEFAULT_NODE_SIZE;
    this.absolute.set(id, {
      x: Math.round(cell[0] * CELL.width + (CELL.width - size.width) / 2),
      y: Math.round(cell[1] * CELL.height + (CELL.height - size.height) / 2),
      width: size.width,
      height: size.height,
    });
    this.nodes.push({
      id,
      kind,
      label,
      ports: defaultPorts(),
      groupId: options.group ?? null,
      metadata: options.metadata ?? {},
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.description ? { description: options.description } : {}),
    });
    return this;
  }

  /** Picks the ports facing each other unless explicit sides are given. */
  edge(from: string, to: string, relation: RelationKind, label?: string, options: EdgeOptions = {}): this {
    const a = this.absolute.get(from);
    const b = this.absolute.get(to);
    if (!a || !b) throw new Error(`Template ${this.meta.id}: edge ${from}→${to} references unknown node`);
    const dx = b.x + b.width / 2 - (a.x + a.width / 2);
    const dy = b.y + b.height / 2 - (a.y + a.height / 2);
    const horizontal = Math.abs(dx) >= Math.abs(dy) * 1.1;
    const fromSide: PortSide = options.fromSide ?? (horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top');
    const toSide: PortSide = options.toSide ?? OPPOSITE[fromSide];
    let id = `e-${from}-${to}`;
    let suffix = 2;
    while (this.ids.has(id)) id = `e-${from}-${to}-${suffix++}`;
    this.claim(id);
    this.edges.push({
      id,
      source: { nodeId: from, portId: `p-${fromSide}` },
      target: { nodeId: to, portId: `p-${toSide}` },
      relation,
      direction: options.direction ?? 'forward',
      ...(label ? { label } : {}),
      ...(options.order !== undefined ? { order: options.order } : {}),
      ...(options.explanation ? { explanation: options.explanation } : {}),
    });
    return this;
  }

  build(): DiagramDocument {
    const groupRects = new Map<string, Rect>();
    const depth = (group: DiagramGroup): number => {
      let d = 0;
      let parent = group.parentGroupId;
      while (parent) {
        d += 1;
        parent = this.groups.find((candidate) => candidate.id === parent)?.parentGroupId ?? null;
      }
      return d;
    };
    const deepestFirst = [...this.groups].sort((a, b) => depth(b) - depth(a));
    for (const group of deepestFirst) {
      const children = [
        ...this.nodes.filter((node) => node.groupId === group.id).map((node) => this.absolute.get(node.id)),
        ...this.groups.filter((child) => child.parentGroupId === group.id).map((child) => groupRects.get(child.id)),
      ].filter((rect): rect is Rect => Boolean(rect));
      const bounds = unionRects(children);
      if (!bounds) throw new Error(`Template ${this.meta.id}: empty group ${group.id}`);
      groupRects.set(group.id, {
        x: bounds.x - GROUP_PADDING.left,
        y: bounds.y - GROUP_PADDING.top,
        width: bounds.width + GROUP_PADDING.left + GROUP_PADDING.right,
        height: bounds.height + GROUP_PADDING.top + GROUP_PADDING.bottom,
      });
    }

    const originOf = (groupId: string | null) => (groupId ? (groupRects.get(groupId) ?? { x: 0, y: 0 }) : { x: 0, y: 0 });
    const layout: DiagramDocument['layout'] = { nodes: {}, groups: {} };
    for (const group of this.groups) {
      const rect = groupRects.get(group.id);
      if (!rect) continue;
      const parent = originOf(group.parentGroupId);
      layout.groups[group.id] = { ...rect, x: rect.x - parent.x, y: rect.y - parent.y };
    }
    for (const node of this.nodes) {
      const rect = this.absolute.get(node.id);
      if (!rect) continue;
      const parent = originOf(node.groupId);
      layout.nodes[node.id] = { ...rect, x: rect.x - parent.x, y: rect.y - parent.y };
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      id: this.meta.id,
      name: this.meta.name,
      description: this.meta.description,
      // Parents before children keeps adapters (React Flow) simple.
      groups: [...this.groups].sort((a, b) => depth(a) - depth(b)),
      nodes: this.nodes,
      edges: this.edges,
      layout,
      presentation: {
        styleId: this.meta.styleId,
        camera: { projection: 'style' },
        appearance: { ...DEFAULT_APPEARANCE, ...this.meta.appearance },
      },
      narrative: { steps: deriveNarrative({ edges: this.edges }) },
    };
  }
}
