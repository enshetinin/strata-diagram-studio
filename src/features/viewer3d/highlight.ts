import { descendantGroups } from '../../domain/commands';
import { effectiveNarrative } from '../../domain/narrative';
import type { DiagramDocument, ElementRef } from '../../domain/types';

export type Emphasis = 'selected' | 'related' | 'normal' | 'dimmed' | 'isolatedOut';

export interface HighlightState {
  node(id: string): Emphasis;
  edge(id: string): Emphasis;
  group(id: string): Emphasis;
  /** Edges that carry illustrative flow particles. */
  activeEdges: string[];
  /** Nodes that must keep their labels regardless of density. */
  labelPriority: Set<string>;
}

/**
 * Derives emphasis from selection, isolation and the narrated step.
 * Pure: the scene only reads it.
 */
export function computeHighlight(
  doc: DiagramDocument,
  selection: ElementRef[],
  isolatedGroupId: string | null,
  presentationStep: number | null,
): HighlightState {
  // While narrating, the step (not the editing selection) drives emphasis.
  const effective = presentationStep === null ? selection : [];
  const selectedNodes = new Set(effective.filter((ref) => ref.type === 'node').map((ref) => ref.id));
  const selectedEdges = new Set(effective.filter((ref) => ref.type === 'edge').map((ref) => ref.id));
  const selectedGroups = new Set(effective.filter((ref) => ref.type === 'group').map((ref) => ref.id));

  let activeEdges: string[] = [...selectedEdges];
  if (presentationStep !== null) {
    const step = effectiveNarrative(doc)[presentationStep];
    activeEdges = step ? step.edgeIds : [];
  }

  const related = new Set<string>();
  const relatedEdges = new Set<string>(activeEdges);
  if (presentationStep === null) {
    for (const edge of doc.edges) {
      if (selectedNodes.has(edge.source.nodeId) || selectedNodes.has(edge.target.nodeId)) {
        relatedEdges.add(edge.id);
        related.add(edge.source.nodeId);
        related.add(edge.target.nodeId);
      }
    }
  }
  for (const edge of doc.edges) {
    if (relatedEdges.has(edge.id) && activeEdges.includes(edge.id)) {
      related.add(edge.source.nodeId);
      related.add(edge.target.nodeId);
    }
  }
  const focusGroups = new Set<string>();
  for (const id of selectedGroups) {
    focusGroups.add(id);
    descendantGroups(doc, id).forEach((child) => focusGroups.add(child));
  }
  for (const node of doc.nodes) if (node.groupId && focusGroups.has(node.groupId)) related.add(node.id);
  // A selected note points at its node; a free note focuses nothing.
  const noteTargets = effective
    .flatMap((ref) =>
      ref.type === 'annotation'
        ? [doc.annotations.find((annotation) => annotation.id === ref.id)?.targetNodeId ?? null]
        : [],
    )
    .filter((id): id is string => id !== null);
  noteTargets.forEach((id) => related.add(id));

  const isolated = new Set<string>();
  if (isolatedGroupId) {
    isolated.add(isolatedGroupId);
    descendantGroups(doc, isolatedGroupId).forEach((child) => isolated.add(child));
  }
  const nodeGroup = new Map(doc.nodes.map((node) => [node.id, node.groupId]));
  const inIsolation = (nodeId: string) => !isolatedGroupId || isolated.has(nodeGroup.get(nodeId) ?? '');

  const anyFocus =
    effective.some((ref) => ref.type !== 'annotation') || noteTargets.length > 0 || presentationStep !== null;

  return {
    node(id) {
      if (!inIsolation(id)) return 'isolatedOut';
      if (selectedNodes.has(id)) return 'selected';
      if (related.has(id)) return 'related';
      return anyFocus ? 'dimmed' : 'normal';
    },
    edge(id) {
      const edge = doc.edges.find((candidate) => candidate.id === id);
      if (edge && (!inIsolation(edge.source.nodeId) || !inIsolation(edge.target.nodeId))) return 'isolatedOut';
      if (selectedEdges.has(id) || activeEdges.includes(id)) return 'selected';
      if (relatedEdges.has(id)) return 'related';
      return anyFocus ? 'dimmed' : 'normal';
    },
    group(id) {
      if (isolatedGroupId && !isolated.has(id)) return 'isolatedOut';
      if (selectedGroups.has(id)) return 'selected';
      return 'normal';
    },
    activeEdges,
    labelPriority: new Set([...selectedNodes, ...related]),
  };
}
