/**
 * Document → React Flow translation. Pure, no state: React Flow never owns a
 * second editable copy of the graph.
 */
import type { Edge, Node } from '@xyflow/react';
import type { DiagramDocument, DiagramEdge, DiagramGroup, DiagramNode, ElementRef } from '../../domain/types';

export type StrataNodeData = { node: DiagramNode; accent: number };
export type GroupNodeData = { group: DiagramGroup; accent: number; depth: number };
export type StrataEdgeData = { edge: DiagramEdge };

export type StrataFlowNode = Node<StrataNodeData, 'strata'>;
export type GroupFlowNode = Node<GroupNodeData, 'group'>;
export type FlowNode = StrataFlowNode | GroupFlowNode;
export type FlowEdge = Edge<StrataEdgeData, 'strata'>;

function isSelected(selection: ElementRef[], type: ElementRef['type'], id: string) {
  return selection.some((ref) => ref.type === type && ref.id === id);
}

export function groupDepths(doc: DiagramDocument): Map<string, number> {
  const byId = new Map(doc.groups.map((group) => [group.id, group]));
  const depths = new Map<string, number>();
  for (const group of doc.groups) {
    let depth = 0;
    let parent = group.parentGroupId;
    while (parent && depth < 100) {
      depth += 1;
      parent = byId.get(parent)?.parentGroupId ?? null;
    }
    depths.set(group.id, depth);
  }
  return depths;
}

export function topLevelAccents(doc: DiagramDocument): (groupId: string | null) => number {
  const byId = new Map(doc.groups.map((group) => [group.id, group]));
  const index = new Map(doc.groups.filter((group) => group.parentGroupId === null).map((group, i) => [group.id, i]));
  return (groupId) => {
    let current = groupId;
    let guard = 0;
    while (current && guard < 100) {
      const group = byId.get(current);
      if (!group) return -1;
      if (!group.parentGroupId) return index.get(group.id) ?? -1;
      current = group.parentGroupId;
      guard += 1;
    }
    return -1;
  };
}

/** Parents are emitted before children, as React Flow requires. */
export function toFlowNodes(doc: DiagramDocument, selection: ElementRef[], isolatedGroupId: string | null = null): FlowNode[] {
  const depths = groupDepths(doc);
  const accentOf = topLevelAccents(doc);
  const groups = [...doc.groups].sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0));
  const result: FlowNode[] = [];
  for (const group of groups) {
    const rect = doc.layout.groups[group.id];
    if (!rect) continue;
    result.push({
      id: group.id,
      type: 'group',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      ...(group.parentGroupId ? { parentId: group.parentGroupId } : {}),
      data: { group, accent: accentOf(group.id), depth: depths.get(group.id) ?? 0 },
      selected: isSelected(selection, 'group', group.id),
      dragHandle: '.strata-group__handle',
      zIndex: depths.get(group.id) ?? 0,
      ariaLabel: `Grupo ${group.label}`,
      ...(isolatedGroupId && isolatedGroupId !== group.id ? { className: 'is-dimmed' } : {}),
    });
  }
  for (const node of doc.nodes) {
    const rect = doc.layout.nodes[node.id];
    if (!rect) continue;
    result.push({
      id: node.id,
      type: 'strata',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      ...(node.groupId ? { parentId: node.groupId } : {}),
      data: { node, accent: accentOf(node.groupId) },
      selected: isSelected(selection, 'node', node.id),
      ariaLabel: `${node.label}`,
    });
  }
  return result;
}

export function toFlowEdges(doc: DiagramDocument, selection: ElementRef[]): FlowEdge[] {
  return doc.edges.map((edge) => ({
    id: edge.id,
    type: 'strata',
    source: edge.source.nodeId,
    sourceHandle: edge.source.portId,
    target: edge.target.nodeId,
    targetHandle: edge.target.portId,
    data: { edge },
    selected: isSelected(selection, 'edge', edge.id),
    reconnectable: true,
    ariaLabel: `Relación ${edge.label ?? edge.relation}`,
  }));
}
