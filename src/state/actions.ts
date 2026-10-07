/**
 * User-level actions: translate intents from any view into document commands,
 * keep selection coherent and report outcomes. Views call these instead of
 * mutating state directly.
 */
import * as cmd from '../domain/commands';
import {
  type DiagramFragment,
  extractFragment,
  type PastePlacement,
  parseClipboardText,
  pasteFragment,
} from '../domain/fragment';
import { deepestGroupAt, documentBounds, findFreeSpot, type Point, resolveAbsoluteLayout } from '../domain/geometry';
import { findConnectablePorts } from '../domain/invariants';
import type { NodeSeed } from '../domain/library';
import { effectiveNarrative } from '../domain/narrative';
import {
  DEFAULT_ANNOTATION_SIZE,
  type DiagramDocument,
  type EdgeEndpoint,
  type ElementRef,
  type RelationKind,
  STYLE_IDS,
  type StyleId,
} from '../domain/types';
import { pasteAnchor } from '../features/editor2d/pasteAnchor';
import { computeAutoLayout, type LayoutDirection } from '../features/layout/elkLayout';
import { createRng } from '../features/templates/random';
import { useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

const doc = () => useDocumentStore.getState().doc;
const ui = () => useUiStore.getState();

function run(label: string, command: (d: DiagramDocument) => DiagramDocument, success?: string): boolean {
  const result = useDocumentStore.getState().execute(label, command);
  if (!result.ok) {
    ui().notify('error', result.error);
    return false;
  }
  if (success) ui().notify('success', success);
  return true;
}

// Drop selections that point to elements that no longer exist.
useDocumentStore.subscribe((state, previous) => {
  if (state.doc === previous.doc) return;
  const { selection, isolatedGroupId } = ui();
  const exists = (ref: ElementRef) => {
    switch (ref.type) {
      case 'node':
        return state.doc.nodes.some((n) => n.id === ref.id);
      case 'edge':
        return state.doc.edges.some((e) => e.id === ref.id);
      case 'group':
        return state.doc.groups.some((g) => g.id === ref.id);
      case 'annotation':
        return state.doc.annotations.some((a) => a.id === ref.id);
    }
  };
  const kept = selection.filter(exists);
  if (kept.length !== selection.length) ui().select(kept);
  if (isolatedGroupId && !state.doc.groups.some((group) => group.id === isolatedGroupId)) ui().isolateGroup(null);
});

export function addNodeAt(
  seed: NodeSeed,
  position: { x: number; y: number },
  groupId: string | null = null,
): string | null {
  const id = cmd.nextId(doc(), 'n');
  const ok = run(`Añadir ${seed.label}`, (d) => cmd.addNode(d, { ...seed, id, position, groupId }));
  if (!ok) return null;
  ui().select([{ type: 'node', id }]);
  return id;
}

/** Adds a node to the right of the current content (used by keyboard / library buttons). */
export function addNodeNearContent(seed: NodeSeed): string | null {
  const current = doc();
  const abs = resolveAbsoluteLayout(current);
  const primary = ui().selection.find((ref) => ref.type === 'node');
  const anchor = primary ? abs.nodes.get(primary.id) : undefined;
  if (anchor) return addNodeAt(seed, { x: anchor.x, y: anchor.y + anchor.height + 64 });
  let maxX = 0;
  let minY = Infinity;
  for (const rect of [...abs.nodes.values(), ...abs.groups.values()]) {
    maxX = Math.max(maxX, rect.x + rect.width);
    minY = Math.min(minY, rect.y);
  }
  return addNodeAt(seed, { x: maxX + 96, y: Number.isFinite(minY) ? minY : 0 });
}

/**
 * New note near `position`. With exactly one node selected the note points
 * at it and sits above its right edge instead. Either way it moves to the
 * nearest spot that does not cover a component or another note.
 */
export function addAnnotationAt(position: Point): string | null {
  const current = doc();
  const selected = ui().selection.filter((ref) => ref.type === 'node');
  const target = selected.length === 1 ? (selected[0]?.id ?? null) : null;
  const abs = resolveAbsoluteLayout(current);
  const targetRect = target ? abs.nodes.get(target) : undefined;
  const preferred = targetRect
    ? { x: targetRect.x + targetRect.width + 48, y: targetRect.y - DEFAULT_ANNOTATION_SIZE.height - 32 }
    : position;
  // Keep clear of components and other notes so the text stays legible in 3D too.
  const at = findFreeSpot(preferred, DEFAULT_ANNOTATION_SIZE, [...abs.nodes.values(), ...abs.annotations.values()]);
  const id = cmd.nextId(current, 'a');
  const ok = run('Añadir nota', (d) => cmd.addAnnotation(d, { id, text: 'Nota', position: at, targetNodeId: target }));
  if (!ok) return null;
  ui().select([{ type: 'annotation', id }]);
  return id;
}

export function updateAnnotation(id: string, patch: cmd.AnnotationPatch): boolean {
  return run(patch.text !== undefined ? 'Editar nota' : 'Cambiar destino de la nota', (d) =>
    cmd.updateAnnotation(d, id, patch),
  );
}

export function connect(source: EdgeEndpoint, target: EdgeEndpoint): boolean {
  const id = cmd.nextId(doc(), 'e');
  const ok = run('Conectar', (d) => cmd.addEdge(d, { id, source, target }));
  if (ok) ui().select([{ type: 'edge', id }]);
  return ok;
}

/** Connects two components without dragging: ports are chosen by the domain (WCAG 2.5.7). */
export function connectNodes(sourceNodeId: string, targetNodeId: string, relation: RelationKind): boolean {
  const ports = findConnectablePorts(doc(), sourceNodeId, targetNodeId);
  if (!ports) {
    ui().notify('error', 'No hay puertos compatibles libres entre esos componentes.');
    return false;
  }
  const id = cmd.nextId(doc(), 'e');
  const ok = run('Conectar', (d) => cmd.addEdge(d, { id, ...ports, relation }));
  if (ok) ui().select([{ type: 'edge', id }]);
  return ok;
}

export function reconnect(edgeId: string, endpoints: { source?: EdgeEndpoint; target?: EdgeEndpoint }): boolean {
  return run('Reconectar', (d) => cmd.reconnectEdge(d, edgeId, endpoints));
}

/** Deletes the selection. Groups ask first whether to keep their content. */
export function deleteSelection(): void {
  const selection = ui().selection;
  if (selection.length === 0) return;
  const groups = selection.filter((ref) => ref.type === 'group').map((ref) => ref.id);
  if (groups.length > 0) {
    ui().requestGroupDeletion(groups);
    return;
  }
  const count = selection.length;
  if (run(count === 1 ? 'Borrar elemento' : `Borrar ${count} elementos`, (d) => cmd.deleteElements(d, selection)))
    ui().clearSelection();
}

export function confirmGroupDeletion(mode: 'keep' | 'delete'): void {
  const pending = ui().pendingGroupDeletion;
  ui().requestGroupDeletion(null);
  if (!pending) return;
  const others = ui().selection.filter((ref) => ref.type !== 'group');
  const refs: ElementRef[] = [...others, ...pending.map((id) => ({ type: 'group' as const, id }))];
  const label = mode === 'keep' ? 'Borrar grupo (conservar contenido)' : 'Borrar grupo y contenido';
  if (run(label, (d) => cmd.deleteElements(d, refs, { groupContents: mode }))) ui().clearSelection();
}

export function groupSelection(): void {
  const selection = ui().selection;
  const nodeIds = selection.filter((ref) => ref.type === 'node').map((ref) => ref.id);
  const groupIds = selection.filter((ref) => ref.type === 'group').map((ref) => ref.id);
  if (nodeIds.length + groupIds.length === 0) {
    ui().notify('warning', 'Selecciona nodos o grupos para agrupar.');
    return;
  }
  const id = cmd.nextId(doc(), 'g');
  if (run('Agrupar', (d) => cmd.groupElements(d, { id, label: 'Nuevo grupo', nodeIds, groupIds })))
    ui().select([{ type: 'group', id }]);
}

export function ungroupSelection(): void {
  const groups = ui().selection.filter((ref) => ref.type === 'group');
  if (groups.length === 0) {
    ui().notify('warning', 'Selecciona un grupo para desagrupar.');
    return;
  }
  if (run('Desagrupar', (d) => groups.reduce((acc, ref) => cmd.ungroup(acc, ref.id), d))) ui().clearSelection();
}

export function duplicateSelection(): void {
  const nodeIds = ui()
    .selection.filter((ref) => ref.type === 'node')
    .map((ref) => ref.id);
  if (nodeIds.length === 0) {
    ui().notify('warning', 'Selecciona nodos para duplicar.');
    return;
  }
  let created: string[] = [];
  const ok = run('Duplicar', (d) => {
    const result = cmd.duplicateNodes(d, nodeIds);
    created = result.ids;
    return result.doc;
  });
  if (ok) ui().select(created.map((id) => ({ type: 'node' as const, id })));
}

// ─── Walkthrough ────────────────────────────────────────────────────────────

/** Selects a step's relations so both views highlight it as the walkthrough would. */
export function previewStep(stepId: string | null): void {
  ui().setNarrativeStep(stepId);
  if (stepId === null) return;
  const step = effectiveNarrative(doc()).find((candidate) => candidate.id === stepId);
  if (step) ui().select(step.edgeIds.map((id) => ({ type: 'edge' as const, id })));
}

/** New step after the open one (or at the end) with the selected relations. */
export function addStepFromSelection(): void {
  const current = doc();
  const edgeIds = ui()
    .selection.filter((ref) => ref.type === 'edge')
    .map((ref) => ref.id);
  const steps = effectiveNarrative(current);
  const open = steps.findIndex((step) => step.id === ui().narrativeStepId);
  const first = current.edges.find((edge) => edge.id === edgeIds[0]);
  const id = cmd.nextStepId(current);
  const title = first?.label ?? `Paso ${(open < 0 ? steps.length : open + 1) + 1}`;
  const label = edgeIds.length > 0 ? 'Nuevo paso con la selección' : 'Nuevo paso';
  if (run(label, (d) => cmd.addStep(d, { id, title, edgeIds, index: open < 0 ? undefined : open + 1 })))
    ui().setNarrativeStep(id);
}

/** Opens the presentation at a given step. */
export function presentFrom(index: number): void {
  ui().setPresenting(true);
  ui().setPresentationStep(index);
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

const PASTE_STEP = 32;

/**
 * Last text this app put on the clipboard. Serves as the fallback when the
 * browser does not deliver clipboard events, and counts repeated pastes so
 * successive copies cascade instead of stacking.
 */
let lastCopied: { text: string; pastes: number } | null = null;

/** Serializes the selection for the clipboard; `null` (with a notice) when nothing is copyable. */
export function copySelection(): string | null {
  const fragment = extractFragment(doc(), ui().selection);
  if (!fragment) {
    ui().notify('warning', 'Selecciona nodos, grupos o notas para copiar.');
    return null;
  }
  const text = JSON.stringify(fragment);
  lastCopied = { text, pastes: 0 };
  return text;
}

/** Copies, then removes the selection including group contents (they travel in the clipboard). */
export function cutSelection(): string | null {
  const text = copySelection();
  if (!text) return null;
  const selection = ui().selection;
  if (!run('Cortar', (d) => cmd.deleteElements(d, selection, { groupContents: 'delete' }))) return null;
  ui().clearSelection();
  return text;
}

/** Text to paste when the browser gave none (no clipboard event / no permission). */
export function lastCopiedText(): string | null {
  return lastCopied?.text ?? null;
}

function placementFor(current: DiagramDocument, fragment: DiagramFragment, repeat: number): PastePlacement {
  const anchor: Point | null = ui().mode === '2d' ? pasteAnchor() : null;
  if (anchor) {
    const containerId = deepestGroupAt(resolveAbsoluteLayout(current), anchor);
    return { containerId, at: { x: anchor.x + repeat * PASTE_STEP, y: anchor.y + repeat * PASTE_STEP } };
  }
  const { documentId, containerId } = fragment.origin;
  if (documentId === current.id) {
    const container =
      containerId !== null && current.groups.some((group) => group.id === containerId) ? containerId : null;
    const step = (repeat + 1) * PASTE_STEP;
    return { containerId: container, offset: { x: step, y: step } };
  }
  // Coordinates from another document mean nothing here: place it beside the content.
  const bounds =
    current.nodes.length + current.groups.length > 0 ? documentBounds(current) : { x: 0, y: 0, width: 0, height: 0 };
  return { containerId: null, at: { x: bounds.x + bounds.width + 96, y: bounds.y + repeat * PASTE_STEP } };
}

/**
 * Pastes Strata content (a copied fragment or a whole document JSON).
 * Returns `false` for unrelated text so the caller can let the browser handle it.
 */
export function pasteText(text: string): boolean {
  const parsed = parseClipboardText(text);
  if (parsed.status === 'none') return false;
  if (parsed.status === 'invalid') {
    ui().notify('error', parsed.message);
    return true;
  }
  const current = doc();
  const repeat = lastCopied?.text === text ? lastCopied.pastes : 0;
  const placement = placementFor(current, parsed.fragment, repeat);
  let roots: ElementRef[] = [];
  const ok = run('Pegar', (d) => {
    const result = pasteFragment(d, parsed.fragment, placement);
    roots = result.roots;
    return result.doc;
  });
  if (!ok) return true;
  if (lastCopied?.text === text) lastCopied.pastes += 1;
  ui().select(roots);
  const count = parsed.fragment.nodes.length + parsed.fragment.groups.length;
  ui().notify('success', count === 1 ? 'Elemento pegado.' : `${count} elementos pegados.`);
  return true;
}

/**
 * Swaps the whole document. Only one diagram is kept in this browser, so the
 * notice always says the previous one was replaced and offers to undo.
 */
export function replaceDocument(next: DiagramDocument, label: string, message?: string): boolean {
  const previous = doc().name;
  const ok = run(label, () => next);
  if (ok) {
    ui().clearSelection();
    ui().isolateGroup(null);
    ui().resetCamera();
    ui().notify('success', `${message ?? `«${next.name}» abierto.`} Reemplaza a «${previous}».`, {
      label: 'Deshacer',
      run: () => useDocumentStore.getState().undo(),
    });
  }
  return ok;
}

export function setStyle(styleId: StyleId): void {
  run('Cambiar estilo', (d) => cmd.setPresentation(d, { styleId }));
}

let layoutRequest = 0;

/**
 * Explicit auto-layout. Results that arrive after a newer request, or after
 * the document changed, are discarded instead of overwriting user edits.
 */
export async function autoLayout(direction: LayoutDirection = 'RIGHT', label = 'Ordenar diagrama'): Promise<boolean> {
  const request = ++layoutRequest;
  const startRevision = useDocumentStore.getState().revision;
  const snapshot = doc();
  try {
    const layout = await computeAutoLayout(snapshot, { direction, spacing: snapshot.presentation.appearance.spacing });
    if (request !== layoutRequest) return false;
    if (useDocumentStore.getState().revision !== startRevision) {
      ui().notify('warning', 'No se reordenó: el diagrama cambió mientras se calculaba.');
      return false;
    }
    const ok = run(label, (d) => cmd.applyLayout(d, layout));
    if (ok) ui().resetCamera();
    return ok;
  } catch (error) {
    ui().notify('error', `No se pudo ordenar el diagrama: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * "Nueva apariencia": changes style, spacing, layer height and layout direction
 * from a seed. Nodes, groups, edges and IDs are untouched.
 */
export function appearanceVariant(
  current: DiagramDocument,
  seed: number,
): { styleId: StyleId; spacing: number; layerHeight: number; direction: LayoutDirection } {
  const rng = createRng(seed);
  const styles = STYLE_IDS.filter((style) => style !== current.presentation.styleId);
  return {
    styleId: rng.pick(styles),
    spacing: rng.pick([0.85, 1, 1.15, 1.3]),
    layerHeight: rng.pick([0.25, 0.45, 0.65, 0.9]),
    direction: rng.pick(['RIGHT', 'RIGHT', 'DOWN'] as const),
  };
}

export async function newAppearance(seed: number, relayout: boolean): Promise<void> {
  const variant = appearanceVariant(doc(), seed);
  const ok = run('Nueva apariencia', (d) =>
    cmd.setPresentation(d, {
      styleId: variant.styleId,
      appearance: { spacing: variant.spacing, layerHeight: variant.layerHeight },
    }),
  );
  if (ok && relayout) await autoLayout(variant.direction, 'Nueva apariencia · ordenar');
}
