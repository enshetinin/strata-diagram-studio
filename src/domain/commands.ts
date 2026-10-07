/**
 * Atomic, pure document commands. Each returns a new document or throws a
 * `CommandError`; the store wraps them in a single history transaction.
 */
import { checkConnection, wouldCreateGroupCycle } from './invariants';
import { deriveNarrative, syncEdgeOrder } from './narrative';
import { LIMITS } from './schema';
import { GROUP_PADDING, resolveAbsoluteLayout, unionRects, type Point } from './geometry';
import {
  DEFAULT_NODE_SIZE,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramLayout,
  type DiagramNode,
  type EdgeEndpoint,
  type ElementRef,
  type NodeKind,
  type NarrativeStep,
  type Port,
  type Presentation,
  type Rect,
} from './types';

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

export function defaultPorts(): Port[] {
  return [
    { id: 'p-top', side: 'top', direction: 'inout', dataType: 'any' },
    { id: 'p-right', side: 'right', direction: 'inout', dataType: 'any' },
    { id: 'p-bottom', side: 'bottom', direction: 'inout', dataType: 'any' },
    { id: 'p-left', side: 'left', direction: 'inout', dataType: 'any' },
  ];
}

/** Deterministic, collision-free ID: `${prefix}-${n}` with the lowest free n. */
export function nextId(doc: DiagramDocument, prefix: string, reserved: ReadonlySet<string> = new Set()): string {
  const used = new Set<string>([...doc.nodes.map((n) => n.id), ...doc.groups.map((g) => g.id), ...doc.edges.map((e) => e.id), ...reserved]);
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function requireNode(doc: DiagramDocument, id: string): DiagramNode {
  const node = doc.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new CommandError(`El nodo «${id}» no existe.`);
  return node;
}

function requireGroup(doc: DiagramDocument, id: string): DiagramGroup {
  const group = doc.groups.find((candidate) => candidate.id === id);
  if (!group) throw new CommandError(`El grupo «${id}» no existe.`);
  return group;
}

function requireEdge(doc: DiagramDocument, id: string): DiagramEdge {
  const edge = doc.edges.find((candidate) => candidate.id === id);
  if (!edge) throw new CommandError(`La relación «${id}» no existe.`);
  return edge;
}

function cloneLayout(layout: DiagramLayout): DiagramLayout {
  return {
    nodes: Object.fromEntries(Object.entries(layout.nodes).map(([id, rect]) => [id, { ...rect }])),
    groups: Object.fromEntries(Object.entries(layout.groups).map(([id, rect]) => [id, { ...rect }])),
  };
}

/**
 * Removes edges (and their narrative references) matching a predicate. A step
 * left without relations disappears; steps that never had any (an intro, a
 * summary) stay.
 */
function withoutEdges(doc: DiagramDocument, remove: (edge: DiagramEdge) => boolean): DiagramDocument {
  const removed = new Set(doc.edges.filter(remove).map((edge) => edge.id));
  if (removed.size === 0) return doc;
  return syncEdgeOrder({
    ...doc,
    edges: doc.edges.filter((edge) => !removed.has(edge.id)),
    narrative: {
      steps: doc.narrative.steps.flatMap((step) => {
        const edgeIds = step.edgeIds.filter((id) => !removed.has(id));
        return edgeIds.length === 0 && step.edgeIds.length > 0 ? [] : [{ ...step, edgeIds }];
      }),
    },
  });
}

/**
 * Grows a group (never shrinks it) so every child sits inside its padding,
 * keeping all children at the same absolute position. Repeats for ancestors.
 */
export function growGroupsToContain(doc: DiagramDocument, groupId: string | null): DiagramDocument {
  if (groupId === null) return doc;
  const layout = cloneLayout(doc.layout);
  let current: string | null = groupId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const group = doc.groups.find((candidate) => candidate.id === current);
    const rect = layout.groups[current];
    if (!group || !rect) break;
    const childNodes = doc.nodes.filter((node) => node.groupId === current).map((node) => layout.nodes[node.id]);
    const childGroups = doc.groups.filter((child) => child.parentGroupId === current).map((child) => layout.groups[child.id]);
    const children = [...childNodes, ...childGroups].filter((child): child is Rect => Boolean(child));
    const bounds = unionRects(children);
    if (bounds) {
      const shiftX = Math.max(0, GROUP_PADDING.left - bounds.x);
      const shiftY = Math.max(0, GROUP_PADDING.top - bounds.y);
      if (shiftX > 0 || shiftY > 0) {
        for (const child of children) {
          child.x += shiftX;
          child.y += shiftY;
        }
        rect.x -= shiftX;
        rect.y -= shiftY;
        rect.width += shiftX;
        rect.height += shiftY;
      }
      rect.width = Math.max(rect.width, bounds.x + shiftX + bounds.width + GROUP_PADDING.right);
      rect.height = Math.max(rect.height, bounds.y + shiftY + bounds.height + GROUP_PADDING.bottom);
    }
    current = group.parentGroupId;
  }
  return { ...doc, layout };
}

// ─── Nodes ──────────────────────────────────────────────────────────────────

export interface AddNodeInput {
  id: string;
  kind: NodeKind;
  label: string;
  /** Absolute canvas position of the node's top-left corner. */
  position: Point;
  groupId?: string | null;
  provider?: string;
  description?: string;
}

export function addNode(doc: DiagramDocument, input: AddNodeInput): DiagramDocument {
  if (doc.nodes.some((node) => node.id === input.id)) throw new CommandError(`ID duplicado «${input.id}».`);
  const groupId = input.groupId ?? null;
  if (groupId) requireGroup(doc, groupId);
  const abs = resolveAbsoluteLayout(doc);
  const origin = groupId ? abs.groups.get(groupId) : undefined;
  const node: DiagramNode = {
    id: input.id,
    kind: input.kind,
    label: input.label,
    ports: defaultPorts(),
    groupId,
    metadata: {},
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
  const next: DiagramDocument = {
    ...doc,
    nodes: [...doc.nodes, node],
    layout: {
      ...doc.layout,
      nodes: {
        ...doc.layout.nodes,
        [node.id]: {
          x: Math.round(input.position.x - (origin?.x ?? 0)),
          y: Math.round(input.position.y - (origin?.y ?? 0)),
          ...DEFAULT_NODE_SIZE,
        },
      },
    },
  };
  return growGroupsToContain(next, groupId);
}

export type NodePatch = Partial<Pick<DiagramNode, 'label' | 'description' | 'kind' | 'provider' | 'metadata'>>;

export function updateNode(doc: DiagramDocument, id: string, patch: NodePatch): DiagramDocument {
  requireNode(doc, id);
  if (patch.label !== undefined && patch.label.trim() === '') throw new CommandError('La etiqueta no puede estar vacía.');
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      if (node.id !== id) return node;
      const merged: DiagramNode = { ...node, ...patch };
      // `undefined` clears optional fields instead of storing undefined.
      if (patch.description === undefined && 'description' in patch) delete merged.description;
      if (patch.provider === undefined && 'provider' in patch) delete merged.provider;
      return merged;
    }),
  };
}

/** Replaces a node's ports; edges that used removed ports go in the same transaction. */
export function setNodePorts(doc: DiagramDocument, id: string, ports: Port[]): DiagramDocument {
  requireNode(doc, id);
  if (ports.length === 0) throw new CommandError('Un nodo necesita al menos un puerto.');
  const ids = new Set(ports.map((port) => port.id));
  if (ids.size !== ports.length) throw new CommandError('Los IDs de puerto deben ser únicos.');
  let next: DiagramDocument = { ...doc, nodes: doc.nodes.map((node) => (node.id === id ? { ...node, ports } : node)) };
  next = withoutEdges(next, (edge) => (edge.source.nodeId === id && !ids.has(edge.source.portId)) || (edge.target.nodeId === id && !ids.has(edge.target.portId)));
  const invalid = next.edges.find((edge) => (edge.source.nodeId === id || edge.target.nodeId === id) && !checkConnection(next, edge.source, edge.target).ok);
  if (invalid) {
    const check = checkConnection(next, invalid.source, invalid.target);
    throw new CommandError(`El cambio rompe la relación «${invalid.label ?? invalid.id}»: ${check.ok ? '' : check.reason}`);
  }
  return next;
}

export interface Move {
  type: 'node' | 'group';
  id: string;
  /** New position local to the element's container. */
  x: number;
  y: number;
}

export function moveElements(doc: DiagramDocument, moves: Move[]): DiagramDocument {
  const layout = cloneLayout(doc.layout);
  const touched = new Set<string | null>();
  for (const move of moves) {
    const bucket = move.type === 'node' ? layout.nodes : layout.groups;
    const rect = bucket[move.id];
    if (!rect) throw new CommandError(`No hay layout para «${move.id}».`);
    rect.x = Math.round(move.x);
    rect.y = Math.round(move.y);
    touched.add(move.type === 'node' ? requireNode(doc, move.id).groupId : requireGroup(doc, move.id).parentGroupId);
  }
  let next: DiagramDocument = { ...doc, layout };
  for (const groupId of touched) next = growGroupsToContain(next, groupId);
  return next;
}

export function resizeElement(doc: DiagramDocument, ref: { type: 'node' | 'group'; id: string }, rect: Rect): DiagramDocument {
  const layout = cloneLayout(doc.layout);
  const bucket = ref.type === 'node' ? layout.nodes : layout.groups;
  if (!bucket[ref.id]) throw new CommandError(`No hay layout para «${ref.id}».`);
  bucket[ref.id] = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(ref.type === 'node' ? 96 : 160, Math.round(rect.width)),
    height: Math.max(ref.type === 'node' ? 48 : 120, Math.round(rect.height)),
  };
  const next = { ...doc, layout };
  const containerId = ref.type === 'node' ? requireNode(doc, ref.id).groupId : requireGroup(doc, ref.id).parentGroupId;
  return growGroupsToContain(growGroupsToContain(next, ref.type === 'group' ? ref.id : null), containerId);
}

// ─── Membership ─────────────────────────────────────────────────────────────

/** Moves a node into another container keeping its absolute position. */
export function setNodeGroup(doc: DiagramDocument, nodeId: string, groupId: string | null): DiagramDocument {
  const node = requireNode(doc, nodeId);
  if (groupId) requireGroup(doc, groupId);
  if (node.groupId === groupId) return doc;
  const abs = resolveAbsoluteLayout(doc);
  const absolute = abs.nodes.get(nodeId);
  const origin = groupId ? abs.groups.get(groupId) : { x: 0, y: 0 };
  if (!absolute || !origin) throw new CommandError('Layout incompleto.');
  const next: DiagramDocument = {
    ...doc,
    nodes: doc.nodes.map((candidate) => (candidate.id === nodeId ? { ...candidate, groupId } : candidate)),
    layout: {
      ...doc.layout,
      nodes: { ...doc.layout.nodes, [nodeId]: { ...absolute, x: absolute.x - origin.x, y: absolute.y - origin.y } },
    },
  };
  return growGroupsToContain(next, groupId);
}

/** Changes a group's parent keeping its absolute position; rejects membership cycles. */
export function setGroupParent(doc: DiagramDocument, groupId: string, parentId: string | null): DiagramDocument {
  const group = requireGroup(doc, groupId);
  if (parentId) requireGroup(doc, parentId);
  if (group.parentGroupId === parentId) return doc;
  if (wouldCreateGroupCycle(doc, groupId, parentId)) throw new CommandError('Ese cambio crearía un ciclo de pertenencia entre grupos.');
  const abs = resolveAbsoluteLayout(doc);
  const absolute = abs.groups.get(groupId);
  const origin = parentId ? abs.groups.get(parentId) : { x: 0, y: 0 };
  if (!absolute || !origin) throw new CommandError('Layout incompleto.');
  const next: DiagramDocument = {
    ...doc,
    groups: doc.groups.map((candidate) => (candidate.id === groupId ? { ...candidate, parentGroupId: parentId } : candidate)),
    layout: {
      ...doc.layout,
      groups: { ...doc.layout.groups, [groupId]: { ...absolute, x: absolute.x - origin.x, y: absolute.y - origin.y } },
    },
  };
  return growGroupsToContain(next, parentId);
}

export interface GroupInput {
  id: string;
  label: string;
  nodeIds: string[];
  groupIds?: string[];
  kind?: DiagramGroup['kind'];
}

/** Wraps nodes/groups that share a container in a new group. */
export function groupElements(doc: DiagramDocument, input: GroupInput): DiagramDocument {
  const groupIds = input.groupIds ?? [];
  if (input.nodeIds.length + groupIds.length === 0) throw new CommandError('Selecciona al menos un elemento para agrupar.');
  if (doc.groups.some((group) => group.id === input.id)) throw new CommandError(`ID duplicado «${input.id}».`);
  const containers = new Set<string | null>([
    ...input.nodeIds.map((id) => requireNode(doc, id).groupId),
    ...groupIds.map((id) => requireGroup(doc, id).parentGroupId),
  ]);
  if (containers.size !== 1) throw new CommandError('Solo se pueden agrupar elementos del mismo contenedor.');
  const parentId = [...containers][0] ?? null;

  const abs = resolveAbsoluteLayout(doc);
  const rects = [...input.nodeIds.map((id) => abs.nodes.get(id)), ...groupIds.map((id) => abs.groups.get(id))].filter((rect): rect is Rect => Boolean(rect));
  const bounds = unionRects(rects);
  if (!bounds) throw new CommandError('Layout incompleto.');
  const parentOrigin = parentId ? (abs.groups.get(parentId) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
  const groupAbs: Rect = {
    x: bounds.x - GROUP_PADDING.left,
    y: bounds.y - GROUP_PADDING.top,
    width: bounds.width + GROUP_PADDING.left + GROUP_PADDING.right,
    height: bounds.height + GROUP_PADDING.top + GROUP_PADDING.bottom,
  };

  const layout = cloneLayout(doc.layout);
  layout.groups[input.id] = { ...groupAbs, x: groupAbs.x - parentOrigin.x, y: groupAbs.y - parentOrigin.y };
  for (const id of input.nodeIds) {
    const rect = abs.nodes.get(id);
    if (rect) layout.nodes[id] = { ...rect, x: rect.x - groupAbs.x, y: rect.y - groupAbs.y };
  }
  for (const id of groupIds) {
    const rect = abs.groups.get(id);
    if (rect) layout.groups[id] = { ...rect, x: rect.x - groupAbs.x, y: rect.y - groupAbs.y };
  }
  const nodeSet = new Set(input.nodeIds);
  const groupSet = new Set(groupIds);
  const next: DiagramDocument = {
    ...doc,
    groups: [
      ...doc.groups.map((group) => (groupSet.has(group.id) ? { ...group, parentGroupId: input.id } : group)),
      { id: input.id, label: input.label, kind: input.kind ?? 'domain', parentGroupId: parentId },
    ],
    nodes: doc.nodes.map((node) => (nodeSet.has(node.id) ? { ...node, groupId: input.id } : node)),
    layout,
  };
  return growGroupsToContain(next, parentId);
}

/** Removes a group, moving its children to the parent with unchanged absolute positions. */
export function ungroup(doc: DiagramDocument, groupId: string): DiagramDocument {
  const group = requireGroup(doc, groupId);
  const abs = resolveAbsoluteLayout(doc);
  const parentOrigin = group.parentGroupId ? (abs.groups.get(group.parentGroupId) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
  const layout = cloneLayout(doc.layout);
  delete layout.groups[groupId];
  const nodes = doc.nodes.map((node) => {
    if (node.groupId !== groupId) return node;
    const rect = abs.nodes.get(node.id);
    if (rect) layout.nodes[node.id] = { ...rect, x: rect.x - parentOrigin.x, y: rect.y - parentOrigin.y };
    return { ...node, groupId: group.parentGroupId };
  });
  const groups = doc.groups
    .filter((candidate) => candidate.id !== groupId)
    .map((candidate) => {
      if (candidate.parentGroupId !== groupId) return candidate;
      const rect = abs.groups.get(candidate.id);
      if (rect) layout.groups[candidate.id] = { ...rect, x: rect.x - parentOrigin.x, y: rect.y - parentOrigin.y };
      return { ...candidate, parentGroupId: group.parentGroupId };
    });
  return { ...doc, nodes, groups, layout };
}

export type GroupUpdate = Partial<Pick<DiagramGroup, 'label' | 'description' | 'kind'>>;

export function updateGroup(doc: DiagramDocument, id: string, patch: GroupUpdate): DiagramDocument {
  requireGroup(doc, id);
  if (patch.label !== undefined && patch.label.trim() === '') throw new CommandError('La etiqueta no puede estar vacía.');
  return { ...doc, groups: doc.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)) };
}

/** All groups nested inside `groupId` (excluding itself). */
export function descendantGroups(doc: DiagramDocument, groupId: string): string[] {
  const result: string[] = [];
  const queue = [groupId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const group of doc.groups) {
      if (group.parentGroupId === current && !result.includes(group.id)) {
        result.push(group.id);
        queue.push(group.id);
      }
    }
  }
  return result;
}

// ─── Deletion ───────────────────────────────────────────────────────────────

export interface DeleteOptions {
  /** `keep` (default) re-parents children of deleted groups; `delete` removes them. */
  groupContents?: 'keep' | 'delete';
}

export function deleteElements(doc: DiagramDocument, refs: ElementRef[], options: DeleteOptions = {}): DiagramDocument {
  const mode = options.groupContents ?? 'keep';
  let next = doc;
  const groupIds = refs.filter((ref) => ref.type === 'group').map((ref) => ref.id);
  const nodeIds = new Set(refs.filter((ref) => ref.type === 'node').map((ref) => ref.id));
  const edgeIds = new Set(refs.filter((ref) => ref.type === 'edge').map((ref) => ref.id));

  if (mode === 'delete') {
    const allGroups = new Set<string>();
    for (const id of groupIds) {
      allGroups.add(id);
      descendantGroups(doc, id).forEach((child) => allGroups.add(child));
    }
    doc.nodes.filter((node) => node.groupId && allGroups.has(node.groupId)).forEach((node) => nodeIds.add(node.id));
    const layout = cloneLayout(next.layout);
    allGroups.forEach((id) => delete layout.groups[id]);
    next = { ...next, groups: next.groups.filter((group) => !allGroups.has(group.id)), layout };
  } else {
    // Ungroup deepest first so each step sees a consistent tree.
    const depth = (id: string) => {
      let d = 0;
      let current = next.groups.find((group) => group.id === id)?.parentGroupId ?? null;
      while (current && d < 1000) {
        d += 1;
        current = next.groups.find((group) => group.id === current)?.parentGroupId ?? null;
      }
      return d;
    };
    [...groupIds].sort((a, b) => depth(b) - depth(a)).forEach((id) => {
      if (next.groups.some((group) => group.id === id)) next = ungroup(next, id);
    });
  }

  if (nodeIds.size > 0) {
    const layout = cloneLayout(next.layout);
    nodeIds.forEach((id) => delete layout.nodes[id]);
    next = { ...next, nodes: next.nodes.filter((node) => !nodeIds.has(node.id)), layout };
  }
  return withoutEdges(next, (edge) => edgeIds.has(edge.id) || nodeIds.has(edge.source.nodeId) || nodeIds.has(edge.target.nodeId));
}

// ─── Edges ──────────────────────────────────────────────────────────────────

export type NewEdge = Pick<DiagramEdge, 'id' | 'source' | 'target'> & Partial<Omit<DiagramEdge, 'id' | 'source' | 'target'>>;

export function addEdge(doc: DiagramDocument, input: NewEdge): DiagramDocument {
  if (doc.edges.some((edge) => edge.id === input.id) || doc.nodes.some((node) => node.id === input.id)) {
    throw new CommandError(`ID duplicado «${input.id}».`);
  }
  const check = checkConnection(doc, input.source, input.target);
  if (!check.ok) throw new CommandError(check.reason);
  const duplicate = doc.edges.some(
    (edge) =>
      edge.source.nodeId === input.source.nodeId &&
      edge.source.portId === input.source.portId &&
      edge.target.nodeId === input.target.nodeId &&
      edge.target.portId === input.target.portId,
  );
  if (duplicate) throw new CommandError('Ya existe una relación entre esos puertos.');
  const edge: DiagramEdge = { relation: 'request', direction: 'forward', ...input };
  return { ...doc, edges: [...doc.edges, edge] };
}

export type EdgePatch = Partial<Pick<DiagramEdge, 'relation' | 'label' | 'direction' | 'order' | 'explanation' | 'bend'>>;

export function updateEdge(doc: DiagramDocument, id: string, patch: EdgePatch): DiagramDocument {
  requireEdge(doc, id);
  return {
    ...doc,
    edges: doc.edges.map((edge) => {
      if (edge.id !== id) return edge;
      const merged: DiagramEdge = { ...edge, ...patch };
      // `undefined` in a patch clears optional fields instead of storing undefined.
      (Object.keys(patch) as (keyof EdgePatch)[]).forEach((key) => {
        if (patch[key] === undefined) delete merged[key];
      });
      return merged;
    }),
  };
}

export function reconnectEdge(doc: DiagramDocument, id: string, endpoints: { source?: EdgeEndpoint; target?: EdgeEndpoint }): DiagramDocument {
  const edge = requireEdge(doc, id);
  const source = endpoints.source ?? edge.source;
  const target = endpoints.target ?? edge.target;
  const check = checkConnection(doc, source, target);
  if (!check.ok) throw new CommandError(check.reason);
  return { ...doc, edges: doc.edges.map((candidate) => (candidate.id === id ? { ...candidate, source, target } : candidate)) };
}

export function reverseEdge(doc: DiagramDocument, id: string): DiagramDocument {
  const edge = requireEdge(doc, id);
  return reconnectEdge(doc, id, { source: edge.target, target: edge.source });
}

// ─── Duplication ────────────────────────────────────────────────────────────

/** Copies nodes (and edges between them) with an offset; returns the new node ids in order. */
export function duplicateNodes(doc: DiagramDocument, nodeIds: string[], offset: Point = { x: 32, y: 32 }): { doc: DiagramDocument; ids: string[] } {
  const reserved = new Set<string>();
  const idMap = new Map<string, string>();
  for (const id of nodeIds) {
    requireNode(doc, id);
    const fresh = nextId(doc, 'n', reserved);
    reserved.add(fresh);
    idMap.set(id, fresh);
  }
  const layout = cloneLayout(doc.layout);
  const copies: DiagramNode[] = [];
  for (const [oldId, newId] of idMap) {
    const node = requireNode(doc, oldId);
    const rect = layout.nodes[oldId];
    if (!rect) continue;
    copies.push({ ...structuredClone(node), id: newId, label: `${node.label} (copia)` });
    layout.nodes[newId] = { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
  }
  const edgeCopies: DiagramEdge[] = [];
  for (const edge of doc.edges) {
    const source = idMap.get(edge.source.nodeId);
    const target = idMap.get(edge.target.nodeId);
    if (!source || !target) continue;
    const id = nextId(doc, 'e', reserved);
    reserved.add(id);
    const copy: DiagramEdge = { ...structuredClone(edge), id, source: { ...edge.source, nodeId: source }, target: { ...edge.target, nodeId: target } };
    delete copy.order;
    edgeCopies.push(copy);
  }
  let next: DiagramDocument = { ...doc, nodes: [...doc.nodes, ...copies], edges: [...doc.edges, ...edgeCopies], layout };
  for (const groupId of new Set(copies.map((copy) => copy.groupId))) next = growGroupsToContain(next, groupId);
  return { doc: next, ids: [...idMap.values()] };
}

// ─── Narrative ──────────────────────────────────────────────────────────────

const NUMBER_PREFIX = /^\d+\.\s+(?=\S)/;

/**
 * Every walkthrough edit starts here: documents that only had `edge.order`
 * get explicit steps, and the "1. " prefixes older documents baked into
 * titles go away (the position is shown separately and changes on reorder).
 */
function editableNarrative(doc: DiagramDocument): NarrativeStep[] {
  const steps = doc.narrative.steps.length > 0 ? doc.narrative.steps : deriveNarrative(doc);
  return steps.map((step) => (NUMBER_PREFIX.test(step.title) ? { ...step, title: step.title.replace(NUMBER_PREFIX, '') } : step));
}

function withSteps(doc: DiagramDocument, steps: NarrativeStep[]): DiagramDocument {
  return syncEdgeOrder({ ...doc, narrative: { steps } });
}

function requireStepIndex(steps: NarrativeStep[], id: string): number {
  const index = steps.findIndex((step) => step.id === id);
  if (index < 0) throw new CommandError(`El paso «${id}» no existe.`);
  return index;
}

/** Deterministic step id that collides neither with steps nor with elements. */
export function nextStepId(doc: DiagramDocument): string {
  const used = new Set(editableNarrative(doc).map((step) => step.id));
  let index = 1;
  while (used.has(`step-${index}`)) index += 1;
  return `step-${index}`;
}

export interface NewStep {
  id: string;
  title: string;
  caption?: string;
  edgeIds?: string[];
  /** Insert position (0-based); appended when omitted. */
  index?: number;
}

/** Adds a step. Its relations leave any step that narrated them before. */
export function addStep(doc: DiagramDocument, input: NewStep): DiagramDocument {
  const steps = editableNarrative(doc);
  if (steps.some((step) => step.id === input.id)) throw new CommandError(`ID de paso duplicado «${input.id}».`);
  const edgeIds = [...new Set(input.edgeIds ?? [])];
  edgeIds.forEach((id) => requireEdge(doc, id));
  const claimed = new Set(edgeIds);
  const rest = steps.map((step) => (step.edgeIds.some((id) => claimed.has(id)) ? { ...step, edgeIds: step.edgeIds.filter((id) => !claimed.has(id)) } : step));
  const step: NarrativeStep = { id: input.id, title: input.title, ...(input.caption ? { caption: input.caption } : {}), edgeIds };
  const index = Math.max(0, Math.min(rest.length, input.index ?? rest.length));
  return withSteps(doc, [...rest.slice(0, index), step, ...rest.slice(index)]);
}

export function updateStep(doc: DiagramDocument, id: string, patch: { title?: string; caption?: string }): DiagramDocument {
  const steps = editableNarrative(doc);
  const index = requireStepIndex(steps, id);
  const next = { ...steps[index]!, ...patch };
  next.title = next.title.trim();
  if (!next.title) throw new CommandError('El paso necesita un título.');
  if (next.title.length > LIMITS.maxLabel) throw new CommandError(`El título admite como máximo ${LIMITS.maxLabel} caracteres.`);
  if (next.caption && next.caption.length > LIMITS.maxText) throw new CommandError(`El texto admite como máximo ${LIMITS.maxText} caracteres.`);
  if (!next.caption) delete next.caption;
  return withSteps(doc, steps.map((step, i) => (i === index ? next : step)));
}

/** Moves a step to `toIndex` (clamped); the markers on the relations renumber. */
export function moveStep(doc: DiagramDocument, id: string, toIndex: number): DiagramDocument {
  const steps = editableNarrative(doc);
  const from = requireStepIndex(steps, id);
  const to = Math.max(0, Math.min(steps.length - 1, toIndex));
  if (from === to) return doc;
  const next = [...steps];
  const [step] = next.splice(from, 1);
  next.splice(to, 0, step!);
  return withSteps(doc, next);
}

export function removeStep(doc: DiagramDocument, id: string): DiagramDocument {
  const steps = editableNarrative(doc);
  requireStepIndex(steps, id);
  return withSteps(doc, steps.filter((step) => step.id !== id));
}

/**
 * Narrates a relation in exactly one step (`null` takes it out of the
 * walkthrough). Steps it leaves are kept, even if empty, while editing.
 */
export function setEdgeStep(doc: DiagramDocument, edgeId: string, stepId: string | null): DiagramDocument {
  requireEdge(doc, edgeId);
  const steps = editableNarrative(doc);
  if (stepId !== null) requireStepIndex(steps, stepId);
  return withSteps(
    doc,
    steps.map((step) => {
      const without = step.edgeIds.filter((id) => id !== edgeId);
      return step.id === stepId ? { ...step, edgeIds: [...without, edgeId] } : without.length === step.edgeIds.length ? step : { ...step, edgeIds: without };
    }),
  );
}

// ─── Layout, presentation and metadata ──────────────────────────────────────

/**
 * Applies a computed layout to elements that still exist; unknown ids are
 * ignored. Manual edge bends are dropped: they were tuned for the old layout.
 */
export function applyLayout(doc: DiagramDocument, layout: DiagramLayout): DiagramDocument {
  const next = cloneLayout(doc.layout);
  for (const node of doc.nodes) {
    const rect = layout.nodes[node.id];
    if (rect) next.nodes[node.id] = { ...rect };
  }
  for (const group of doc.groups) {
    const rect = layout.groups[group.id];
    if (rect) next.groups[group.id] = { ...rect };
  }
  const edges = doc.edges.some((edge) => edge.bend) ? doc.edges.map(({ bend: _bend, ...edge }) => edge) : doc.edges;
  return { ...doc, edges, layout: next };
}

export interface PresentationPatch {
  styleId?: Presentation['styleId'];
  camera?: Partial<Presentation['camera']>;
  appearance?: Partial<Presentation['appearance']>;
}

export function setPresentation(doc: DiagramDocument, patch: PresentationPatch): DiagramDocument {
  return {
    ...doc,
    presentation: {
      styleId: patch.styleId ?? doc.presentation.styleId,
      camera: { ...doc.presentation.camera, ...patch.camera },
      appearance: { ...doc.presentation.appearance, ...patch.appearance },
    },
  };
}

export function setDocumentInfo(doc: DiagramDocument, info: { name?: string; description?: string }): DiagramDocument {
  if (info.name !== undefined && info.name.trim() === '') throw new CommandError('El nombre no puede estar vacío.');
  return { ...doc, ...info };
}
