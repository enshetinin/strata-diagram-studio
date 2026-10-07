import type { DiagramDocument, DiagramGroup, DiagramNode, EdgeEndpoint, Port } from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string };

function portAccepts(port: Port, role: 'source' | 'target'): boolean {
  if (port.direction === 'inout') return true;
  return role === 'source' ? port.direction === 'out' : port.direction === 'in';
}

function dataTypesCompatible(a: Port, b: Port): boolean {
  return a.dataType === 'any' || b.dataType === 'any' || a.dataType === b.dataType;
}

/** Checks a prospective connection against the ports it would use. */
export function checkConnection(doc: DiagramDocument, source: EdgeEndpoint, target: EdgeEndpoint): ConnectionCheck {
  const sourceNode = doc.nodes.find((node) => node.id === source.nodeId);
  const targetNode = doc.nodes.find((node) => node.id === target.nodeId);
  if (!sourceNode || !targetNode) return { ok: false, reason: 'El extremo no existe.' };
  const sourcePort = sourceNode.ports.find((port) => port.id === source.portId);
  const targetPort = targetNode.ports.find((port) => port.id === target.portId);
  if (!sourcePort || !targetPort) return { ok: false, reason: 'El puerto no existe.' };
  if (sourceNode.id === targetNode.id && sourcePort.id === targetPort.id) {
    return { ok: false, reason: 'Un puerto no puede conectarse consigo mismo.' };
  }
  if (!portAccepts(sourcePort, 'source')) {
    return { ok: false, reason: `El puerto «${sourcePort.label ?? sourcePort.id}» solo admite entradas.` };
  }
  if (!portAccepts(targetPort, 'target')) {
    return { ok: false, reason: `El puerto «${targetPort.label ?? targetPort.id}» solo admite salidas.` };
  }
  if (!dataTypesCompatible(sourcePort, targetPort)) {
    return {
      ok: false,
      reason: `Tipos incompatibles: ${sourcePort.dataType} → ${targetPort.dataType}.`,
    };
  }
  return { ok: true };
}

/** Returns the chain of ancestors of a group, nearest first. Stops on cycles. */
export function groupAncestors(groups: ReadonlyMap<string, DiagramGroup>, groupId: string | null): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = groupId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    chain.push(current);
    current = groups.get(current)?.parentGroupId ?? null;
  }
  return chain;
}

/** True when making `parentId` the parent of `groupId` would create a membership cycle. */
export function wouldCreateGroupCycle(doc: DiagramDocument, groupId: string, parentId: string | null): boolean {
  if (parentId === null) return false;
  if (parentId === groupId) return true;
  const groups = new Map(doc.groups.map((group) => [group.id, group]));
  return groupAncestors(groups, parentId).includes(groupId);
}

/**
 * Referential and structural invariants that a schema cannot express.
 * Run after the Zod schema has accepted the shape.
 */
export function validateInvariants(doc: DiagramDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, string>();
  const claim = (id: string, path: string) => {
    const previous = seenIds.get(id);
    if (previous) issues.push({ path, message: `ID duplicado «${id}» (ya usado en ${previous}).` });
    else seenIds.set(id, path);
  };

  doc.groups.forEach((group, index) => claim(group.id, `groups[${index}]`));
  doc.nodes.forEach((node, index) => claim(node.id, `nodes[${index}]`));
  doc.edges.forEach((edge, index) => claim(edge.id, `edges[${index}]`));
  doc.annotations.forEach((annotation, index) => claim(annotation.id, `annotations[${index}]`));

  const groups = new Map(doc.groups.map((group) => [group.id, group]));
  const nodes = new Map<string, DiagramNode>(doc.nodes.map((node) => [node.id, node]));

  doc.groups.forEach((group, index) => {
    if (group.parentGroupId === null) return;
    if (!groups.has(group.parentGroupId)) {
      issues.push({
        path: `groups[${index}].parentGroupId`,
        message: `Grupo padre inexistente «${group.parentGroupId}».`,
      });
      return;
    }
    const seen = new Set<string>([group.id]);
    let current: string | null = group.parentGroupId;
    while (current) {
      if (seen.has(current)) {
        issues.push({
          path: `groups[${index}].parentGroupId`,
          message: `Ciclo de pertenencia en el grupo «${group.id}».`,
        });
        break;
      }
      seen.add(current);
      current = groups.get(current)?.parentGroupId ?? null;
    }
  });

  doc.nodes.forEach((node, index) => {
    if (node.groupId !== null && !groups.has(node.groupId)) {
      issues.push({ path: `nodes[${index}].groupId`, message: `Grupo inexistente «${node.groupId}».` });
    }
    const portIds = new Set<string>();
    node.ports.forEach((port, portIndex) => {
      if (portIds.has(port.id)) {
        issues.push({
          path: `nodes[${index}].ports[${portIndex}]`,
          message: `Puerto duplicado «${port.id}» en «${node.id}».`,
        });
      }
      portIds.add(port.id);
    });
    if (!doc.layout.nodes[node.id]) {
      issues.push({ path: `layout.nodes.${node.id}`, message: `Falta el layout del nodo «${node.id}».` });
    }
  });

  doc.groups.forEach((group) => {
    if (!doc.layout.groups[group.id]) {
      issues.push({ path: `layout.groups.${group.id}`, message: `Falta el layout del grupo «${group.id}».` });
    }
  });

  doc.edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (!nodes.has(edge.source.nodeId) || !nodes.has(edge.target.nodeId)) {
      issues.push({ path, message: `La relación «${edge.id}» apunta a un nodo inexistente.` });
      return;
    }
    const check = checkConnection(doc, edge.source, edge.target);
    if (!check.ok) issues.push({ path, message: `Relación «${edge.id}»: ${check.reason}` });
  });

  const edgeIds = new Set(doc.edges.map((edge) => edge.id));
  doc.narrative.steps.forEach((step, index) => {
    step.edgeIds.forEach((edgeId) => {
      if (!edgeIds.has(edgeId)) {
        issues.push({
          path: `narrative.steps[${index}]`,
          message: `El paso «${step.id}» cita una relación inexistente «${edgeId}».`,
        });
      }
    });
  });

  const annotations = new Set(doc.annotations.map((annotation) => annotation.id));
  doc.annotations.forEach((annotation, index) => {
    if (annotation.targetNodeId !== null && !nodes.has(annotation.targetNodeId)) {
      issues.push({
        path: `annotations[${index}].targetNodeId`,
        message: `La nota «${annotation.id}» apunta a un nodo inexistente.`,
      });
    }
    if (!doc.layout.annotations[annotation.id]) {
      issues.push({
        path: `layout.annotations.${annotation.id}`,
        message: `Falta el layout de la nota «${annotation.id}».`,
      });
    }
  });
  for (const key of Object.keys(doc.layout.annotations)) {
    if (!annotations.has(key)) issues.push({ path: `layout.annotations.${key}`, message: `Layout huérfano «${key}».` });
  }

  for (const key of Object.keys(doc.layout.nodes)) {
    if (!nodes.has(key)) issues.push({ path: `layout.nodes.${key}`, message: `Layout huérfano «${key}».` });
  }
  for (const key of Object.keys(doc.layout.groups)) {
    if (!groups.has(key)) issues.push({ path: `layout.groups.${key}`, message: `Layout huérfano «${key}».` });
  }

  return issues;
}
