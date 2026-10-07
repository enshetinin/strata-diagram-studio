/**
 * Text alternative for the 3D scene (WCAG 1.1.1): the same components,
 * groups and relations the canvas draws, as lists a screen reader can walk.
 * Derived from the document, never from the rendered scene.
 */
import { KIND_INFO, RELATION_INFO } from '../../domain/catalog';
import type { DiagramDocument } from '../../domain/types';

export interface SceneDescription {
  /** Groups in document order, each with the components directly inside it. */
  groups: { id: string; label: string; depth: number; components: string[] }[];
  /** Components outside any group. */
  ungrouped: string[];
  /** One sentence per relation, walkthrough order first. */
  relations: { id: string; text: string }[];
}

export function describeScene(doc: DiagramDocument): SceneDescription {
  const component = (id: string) => {
    const node = doc.nodes.find((candidate) => candidate.id === id);
    return node ? `${node.label} (${KIND_INFO[node.kind].label.toLowerCase()})` : id;
  };
  const parent = new Map(doc.groups.map((group) => [group.id, group.parentGroupId ?? null]));
  const depth = (id: string | null): number => {
    let level = 0;
    for (let current = id ? (parent.get(id) ?? null) : null; current && level < 100; level += 1)
      current = parent.get(current) ?? null;
    return level;
  };
  const label = (id: string) => doc.nodes.find((node) => node.id === id)?.label ?? id;
  const relations = [...doc.edges]
    .sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY))
    .map((edge) => {
      const arrow = edge.direction === 'bidirectional' ? '↔' : '→';
      const step = edge.order !== undefined ? `${edge.order}. ` : '';
      const detail = edge.label ? `: ${edge.label}` : '';
      return {
        id: edge.id,
        text: `${step}${label(edge.source.nodeId)} ${arrow} ${label(edge.target.nodeId)} (${RELATION_INFO[edge.relation].label.toLowerCase()}${detail})`,
      };
    });
  return {
    groups: doc.groups.map((group) => ({
      id: group.id,
      label: group.label,
      depth: depth(group.id),
      components: doc.nodes.filter((node) => node.groupId === group.id).map((node) => component(node.id)),
    })),
    ungrouped: doc.nodes.filter((node) => !node.groupId).map((node) => component(node.id)),
    relations,
  };
}
