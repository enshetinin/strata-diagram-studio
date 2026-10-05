import type { DiagramDocument, NarrativeStep } from './types';

/** Builds walkthrough steps from edges that declare an `order`. */
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
        title: first?.label ? `${order}. ${first.label}` : `Paso ${order}`,
        ...(first?.explanation ? { caption: first.explanation } : {}),
        edgeIds,
      };
    });
}

/** Explicit narrative when present, otherwise the one implied by edge order. */
export function effectiveNarrative(doc: DiagramDocument): NarrativeStep[] {
  return doc.narrative.steps.length > 0 ? doc.narrative.steps : deriveNarrative(doc);
}
