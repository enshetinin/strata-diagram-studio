/**
 * Explicit auto-layout via ELK (layered). Receives real node sizes, the group
 * hierarchy and ports with fixed sides, and returns group-local rectangles.
 * Never runs implicitly during render.
 */
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import { GROUP_PADDING } from '../../domain/geometry';
import type { DiagramDocument, DiagramLayout, PortSide } from '../../domain/types';

export type LayoutDirection = 'RIGHT' | 'DOWN';

export interface AutoLayoutOptions {
  direction: LayoutDirection;
  /** Multiplier from the appearance panel (0.6 – 1.8). */
  spacing: number;
}

const ELK_SIDE: Record<PortSide, string> = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' };

const portKey = (nodeId: string, portId: string) => `${nodeId}::${portId}`;

export function buildElkGraph(doc: DiagramDocument, options: AutoLayoutOptions): ElkNode {
  const spacing = options.spacing;
  const nodeSpacing = String(Math.round(56 * spacing));
  const layerSpacing = String(Math.round(88 * spacing));
  const containerOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': options.direction,
    'elk.spacing.nodeNode': nodeSpacing,
    'elk.layered.spacing.nodeNodeBetweenLayers': layerSpacing,
    'elk.spacing.edgeNode': String(Math.round(24 * spacing)),
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.padding': `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
  };

  const elkNodeFor = (nodeId: string): ElkNode => {
    const node = doc.nodes.find((candidate) => candidate.id === nodeId);
    const rect = doc.layout.nodes[nodeId];
    return {
      id: nodeId,
      width: rect?.width ?? 176,
      height: rect?.height ?? 80,
      layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
      ports: (node?.ports ?? []).map((port) => ({
        id: portKey(nodeId, port.id),
        width: 8,
        height: 8,
        layoutOptions: { 'elk.port.side': ELK_SIDE[port.side] },
      })),
    };
  };

  const elkGroupFor = (groupId: string): ElkNode => ({
    id: groupId,
    layoutOptions: containerOptions,
    children: [
      ...doc.groups.filter((group) => group.parentGroupId === groupId).map((group) => elkGroupFor(group.id)),
      ...doc.nodes.filter((node) => node.groupId === groupId).map((node) => elkNodeFor(node.id)),
    ],
  });

  const edges: ElkExtendedEdge[] = doc.edges.map((edge) => ({
    id: edge.id,
    sources: [portKey(edge.source.nodeId, edge.source.portId)],
    targets: [portKey(edge.target.nodeId, edge.target.portId)],
  }));

  return {
    id: '__root__',
    layoutOptions: { ...containerOptions, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.padding': '[top=0,left=0,bottom=0,right=0]' },
    children: [
      ...doc.groups.filter((group) => group.parentGroupId === null).map((group) => elkGroupFor(group.id)),
      ...doc.nodes.filter((node) => node.groupId === null).map((node) => elkNodeFor(node.id)),
    ],
    edges,
  };
}

/** Converts ELK output (already parent-relative) into the canonical layout. */
export function readElkResult(doc: DiagramDocument, root: ElkNode): DiagramLayout {
  const groupIds = new Set(doc.groups.map((group) => group.id));
  const layout: DiagramLayout = { nodes: {}, groups: {}, annotations: {} };
  const visit = (elkNode: ElkNode) => {
    for (const child of elkNode.children ?? []) {
      const rect = { x: Math.round(child.x ?? 0), y: Math.round(child.y ?? 0), width: Math.round(child.width ?? 0), height: Math.round(child.height ?? 0) };
      if (groupIds.has(child.id)) layout.groups[child.id] = rect;
      else layout.nodes[child.id] = rect;
      visit(child);
    }
  };
  visit(root);
  return layout;
}

let elkInstance: Promise<{ layout: (graph: ElkNode) => Promise<ElkNode> }> | null = null;

/** ELK is ~1.5 MB; it is only loaded when the user asks for auto-layout. */
async function getElk() {
  elkInstance ??= import('elkjs/lib/elk.bundled.js')
    .then(({ default: ELK }) => new ELK())
    .catch((error: unknown) => {
      // A failed chunk load (offline, new deploy) must not poison every later attempt.
      elkInstance = null;
      throw error;
    });
  return elkInstance;
}

export async function computeAutoLayout(doc: DiagramDocument, options: AutoLayoutOptions): Promise<DiagramLayout> {
  const elk = await getElk();
  const result = await elk.layout(buildElkGraph(doc, options));
  return readElkResult(doc, result);
}
