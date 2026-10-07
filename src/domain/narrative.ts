import type { DiagramDocument, DiagramEdge, NarrativeStep } from './types';

/** Builds walkthrough steps from edges that declare an `order` (documents without explicit steps). */
export function deriveNarrative(doc: Pick<DiagramDocument, 'edges'>): NarrativeStep[] {
  const byOrder = new Map<number, string[]>();
  for (const edge of doc.edges) {
    if (edge.order === undefined) continue;
    byOrder.set(edge.order, [...(byOrder.get(edge.order) ?? []), edge.id]);
  }
  return [...byOrder.entries()]
    .sort(([a], [b]) => a - b)
    .map(([order, edgeIds]) => {
      const first = doc.edges.find((edge) => edge.id === edgeIds[0]);
      return {
        id: `step-${order}`,
        title: first?.label ?? `Paso ${order}`,
        ...(first?.explanation ? { caption: first.explanation } : {}),
        edgeIds,
      };
    });
}

/** Explicit narrative when present, otherwise the one implied by edge order. */
export function effectiveNarrative(doc: DiagramDocument): NarrativeStep[] {
  return doc.narrative.steps.length > 0 ? doc.narrative.steps : deriveNarrative(doc);
}

/**
 * Once explicit steps exist they are the source of truth, and `edge.order`
 * mirrors them: the 1-based position of the first step that narrates the
 * edge, or nothing. Renderers keep reading `order` for the step markers.
 */
export function syncEdgeOrder(doc: DiagramDocument): DiagramDocument {
  if (doc.narrative.steps.length === 0) return doc;
  const position = new Map<string, number>();
  doc.narrative.steps.forEach((step, index) => {
    for (const id of step.edgeIds) if (!position.has(id)) position.set(id, index + 1);
  });
  let changed = false;
  const edges = doc.edges.map((edge): DiagramEdge => {
    const order = position.get(edge.id);
    if (order === edge.order) return edge;
    changed = true;
    const next = { ...edge };
    if (order === undefined) delete next.order;
    else next.order = order;
    return next;
  });
  return changed ? { ...doc, edges } : doc;
}
