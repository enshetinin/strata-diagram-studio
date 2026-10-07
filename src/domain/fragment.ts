/**
 * Clipboard fragments: a self-contained slice of a document (nodes, groups and
 * the relations between them) that can be pasted into any document.
 *
 * Coordinates follow the document convention: elements whose container is
 * inside the fragment keep their local rectangle; fragment roots store
 * absolute canvas coordinates of the source document.
 */
import { z } from 'zod';
import { CommandError, descendantGroups, growGroupsToContain, nextId } from './commands';
import { containerOrigin, resolveAbsoluteLayout, unionRects, type Point } from './geometry';
import { parseDocument } from './parse';
import { annotationSchema, edgeSchema, groupSchema, LIMITS, nodeSchema, rectSchema } from './schema';
import {
  DEFAULT_ANNOTATION_SIZE,
  DEFAULT_NODE_SIZE,
  SCHEMA_VERSION,
  type DiagramAnnotation,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type ElementRef,
  type Rect,
} from './types';

export const FRAGMENT_FORMAT = 'strata/fragment';

export interface DiagramFragment {
  format: typeof FRAGMENT_FORMAT;
  schemaVersion: typeof SCHEMA_VERSION;
  /** Where it was copied from; lets a same-document paste keep the original container. */
  origin: { documentId: string; containerId: string | null };
  nodes: DiagramNode[];
  groups: DiagramGroup[];
  edges: DiagramEdge[];
  /** Notes are always roots; a target outside the fragment is dropped on paste. */
  annotations: DiagramAnnotation[];
  layout: { nodes: Record<string, Rect>; groups: Record<string, Rect>; annotations: Record<string, Rect> };
}

const fragmentSchema = z.object({
  format: z.literal(FRAGMENT_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  origin: z.object({ documentId: z.string().max(LIMITS.maxIdLength), containerId: z.string().max(LIMITS.maxIdLength).nullable() }),
  nodes: z.array(nodeSchema).max(LIMITS.maxNodes),
  groups: z.array(groupSchema).max(LIMITS.maxGroups),
  edges: z.array(edgeSchema).max(LIMITS.maxEdges),
  annotations: z.array(annotationSchema).max(LIMITS.maxAnnotations).default([]),
  layout: z.object({ nodes: z.record(z.string(), rectSchema), groups: z.record(z.string(), rectSchema), annotations: z.record(z.string(), rectSchema).default({}) }),
});

/**
 * Copies the selection: selected nodes, selected groups with everything they
 * contain, and every relation whose two ends are copied. Selected relations
 * without both ends are ignored. Returns `null` when nothing is copyable.
 */
export function extractFragment(doc: DiagramDocument, refs: readonly ElementRef[]): DiagramFragment | null {
  const groupIds = new Set<string>();
  for (const ref of refs) {
    if (ref.type !== 'group' || !doc.groups.some((group) => group.id === ref.id)) continue;
    groupIds.add(ref.id);
    descendantGroups(doc, ref.id).forEach((id) => groupIds.add(id));
  }
  const selectedNodes = new Set(refs.filter((ref) => ref.type === 'node').map((ref) => ref.id));
  const nodes = doc.nodes.filter((node) => selectedNodes.has(node.id) || (node.groupId !== null && groupIds.has(node.groupId)));
  const groups = doc.groups.filter((group) => groupIds.has(group.id));
  const selectedAnnotations = new Set(refs.filter((ref) => ref.type === 'annotation').map((ref) => ref.id));
  const annotations = doc.annotations.filter((annotation) => selectedAnnotations.has(annotation.id));
  if (nodes.length === 0 && groups.length === 0 && annotations.length === 0) return null;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const abs = resolveAbsoluteLayout(doc);
  const layout: DiagramFragment['layout'] = { nodes: {}, groups: {}, annotations: {} };
  for (const annotation of annotations) {
    const rect = doc.layout.annotations[annotation.id];
    if (rect) layout.annotations[annotation.id] = { ...rect };
  }
  const containers = new Set<string | null>();

  const fragmentGroups = groups.map((group): DiagramGroup => {
    const inside = group.parentGroupId !== null && groupIds.has(group.parentGroupId);
    const rect = inside ? doc.layout.groups[group.id] : abs.groups.get(group.id);
    if (rect) layout.groups[group.id] = { ...rect };
    if (!inside) containers.add(group.parentGroupId);
    return { ...structuredClone(group), parentGroupId: inside ? group.parentGroupId : null };
  });
  const fragmentNodes = nodes.map((node): DiagramNode => {
    const inside = node.groupId !== null && groupIds.has(node.groupId);
    const rect = inside ? doc.layout.nodes[node.id] : abs.nodes.get(node.id);
    if (rect) layout.nodes[node.id] = { ...rect };
    if (!inside) containers.add(node.groupId);
    return { ...structuredClone(node), groupId: inside ? node.groupId : null };
  });
  const edges = doc.edges.filter((edge) => nodeIds.has(edge.source.nodeId) && nodeIds.has(edge.target.nodeId)).map((edge) => structuredClone(edge));

  return {
    format: FRAGMENT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    origin: { documentId: doc.id, containerId: containers.size === 1 ? [...containers][0]! : null },
    nodes: fragmentNodes,
    groups: fragmentGroups,
    edges,
    annotations: annotations.map((annotation) => structuredClone(annotation)),
    layout,
  };
}

/** A whole document pasted as text becomes a fragment with all of its content. */
function fragmentFromDocument(doc: DiagramDocument): DiagramFragment {
  const fragment = extractFragment(doc, [
    ...doc.nodes.map((node) => ({ type: 'node' as const, id: node.id })),
    ...doc.groups.map((group) => ({ type: 'group' as const, id: group.id })),
    ...doc.annotations.map((annotation) => ({ type: 'annotation' as const, id: annotation.id })),
  ]);
  return {
    ...(fragment ?? { format: FRAGMENT_FORMAT, schemaVersion: SCHEMA_VERSION, nodes: [], groups: [], edges: [], annotations: [], layout: { nodes: {}, groups: {}, annotations: {} } }),
    origin: { documentId: doc.id, containerId: null },
  };
}

export type ClipboardParse = { status: 'none' } | { status: 'ok'; fragment: DiagramFragment } | { status: 'invalid'; message: string };

/**
 * Reads clipboard text. Anything that is not Strata content returns `none`
 * so the caller can leave the paste alone; Strata content that fails
 * validation returns `invalid` and never reaches the document.
 */
export function parseClipboardText(text: string): ClipboardParse {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { status: 'none' };
  if (trimmed.length > LIMITS.maxBytes) return { status: 'invalid', message: 'El contenido del portapapeles es demasiado grande.' };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { status: 'none' };
  }
  if (typeof raw !== 'object' || raw === null) return { status: 'none' };
  const record = raw as Record<string, unknown>;

  if (record.format === FRAGMENT_FORMAT) {
    const parsed = fragmentSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { status: 'invalid', message: `El fragmento copiado no es válido${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.` };
    }
    return { status: 'ok', fragment: parsed.data };
  }
  if ('schemaVersion' in record && Array.isArray(record.nodes)) {
    const result = parseDocument(raw);
    if (!result.ok) return { status: 'invalid', message: `El documento pegado no es válido: ${result.message}` };
    return { status: 'ok', fragment: fragmentFromDocument(result.document) };
  }
  return { status: 'none' };
}

export interface PastePlacement {
  /** Group that receives the fragment roots; `null` is the canvas. */
  containerId: string | null;
  /** Absolute position for the top-left corner of the fragment. */
  at?: Point;
  /** Used when `at` is absent: displacement from the copied position. */
  offset?: Point;
}

/**
 * Inserts a fragment with fresh IDs. Relations whose ends are missing from the
 * fragment are dropped and walkthrough order is cleared, as with duplication.
 * Returns the new top-level elements so the caller can select them.
 */
export function pasteFragment(doc: DiagramDocument, fragment: DiagramFragment, placement: PastePlacement): { doc: DiagramDocument; roots: ElementRef[] } {
  const { containerId } = placement;
  if (containerId !== null && !doc.groups.some((group) => group.id === containerId)) throw new CommandError(`El grupo «${containerId}» no existe.`);
  if (fragment.nodes.length === 0 && fragment.groups.length === 0 && fragment.annotations.length === 0) throw new CommandError('No hay nada que pegar.');
  if (
    doc.nodes.length + fragment.nodes.length > LIMITS.maxNodes ||
    doc.groups.length + fragment.groups.length > LIMITS.maxGroups ||
    doc.edges.length + fragment.edges.length > LIMITS.maxEdges ||
    doc.annotations.length + fragment.annotations.length > LIMITS.maxAnnotations
  ) {
    throw new CommandError('Pegar superaría el tamaño máximo del documento.');
  }

  const reserved = new Set<string>();
  const fresh = (prefix: string) => {
    const id = nextId(doc, prefix, reserved);
    reserved.add(id);
    return id;
  };
  const groupMap = new Map(fragment.groups.map((group) => [group.id, fresh('g')]));
  const nodeMap = new Map(fragment.nodes.map((node) => [node.id, fresh('n')]));

  const isRootGroup = (group: DiagramGroup) => group.parentGroupId === null || !groupMap.has(group.parentGroupId);
  const isRootNode = (node: DiagramNode) => node.groupId === null || !groupMap.has(node.groupId);
  const fallbackRect = (): Rect => ({ x: 0, y: 0, ...DEFAULT_NODE_SIZE });
  const groupRect = (group: DiagramGroup) => fragment.layout.groups[group.id] ?? fallbackRect();
  const nodeRect = (node: DiagramNode) => fragment.layout.nodes[node.id] ?? fallbackRect();

  const annotationRect = (annotation: DiagramAnnotation) => fragment.layout.annotations[annotation.id] ?? { x: 0, y: 0, ...DEFAULT_ANNOTATION_SIZE };
  const rootRects = [...fragment.groups.filter(isRootGroup).map(groupRect), ...fragment.nodes.filter(isRootNode).map(nodeRect), ...fragment.annotations.map(annotationRect)];
  const bounds = unionRects(rootRects) ?? { x: 0, y: 0, width: 0, height: 0 };
  const shift = placement.at ? { x: placement.at.x - bounds.x, y: placement.at.y - bounds.y } : (placement.offset ?? { x: 0, y: 0 });
  const origin = containerOrigin(doc, containerId);
  const place = (rect: Rect, root: boolean): Rect => (root ? { ...rect, x: Math.round(rect.x + shift.x - origin.x), y: Math.round(rect.y + shift.y - origin.y) } : { ...rect });

  const layout = { nodes: { ...doc.layout.nodes }, groups: { ...doc.layout.groups }, annotations: { ...doc.layout.annotations } };
  const roots: ElementRef[] = [];

  const groups = fragment.groups.map((group): DiagramGroup => {
    const id = groupMap.get(group.id)!;
    const root = isRootGroup(group);
    layout.groups[id] = place(groupRect(group), root);
    if (root) roots.push({ type: 'group', id });
    return { ...structuredClone(group), id, parentGroupId: root ? containerId : groupMap.get(group.parentGroupId!)! };
  });
  const nodes = fragment.nodes.map((node): DiagramNode => {
    const id = nodeMap.get(node.id)!;
    const root = isRootNode(node);
    layout.nodes[id] = place(nodeRect(node), root);
    if (root) roots.push({ type: 'node', id });
    return { ...structuredClone(node), id, groupId: root ? containerId : groupMap.get(node.groupId!)! };
  });
  const edges = fragment.edges.flatMap((edge): DiagramEdge[] => {
    const source = nodeMap.get(edge.source.nodeId);
    const target = nodeMap.get(edge.target.nodeId);
    if (!source || !target) return [];
    const copy: DiagramEdge = { ...structuredClone(edge), id: fresh('e'), source: { ...edge.source, nodeId: source }, target: { ...edge.target, nodeId: target } };
    delete copy.order;
    return [copy];
  });

  // Notes sit on the canvas, never in the paste container: shift only, in absolute coordinates.
  const annotations = fragment.annotations.map((annotation): DiagramAnnotation => {
    const id = fresh('a');
    const rect = annotationRect(annotation);
    layout.annotations[id] = { ...rect, x: Math.round(rect.x + shift.x), y: Math.round(rect.y + shift.y) };
    roots.push({ type: 'annotation', id });
    return { ...structuredClone(annotation), id, targetNodeId: annotation.targetNodeId ? (nodeMap.get(annotation.targetNodeId) ?? null) : null };
  });

  const next: DiagramDocument = {
    ...doc,
    nodes: [...doc.nodes, ...nodes],
    groups: [...doc.groups, ...groups],
    edges: [...doc.edges, ...edges],
    annotations: [...doc.annotations, ...annotations],
    layout,
  };
  return { doc: growGroupsToContain(next, containerId), roots };
}
