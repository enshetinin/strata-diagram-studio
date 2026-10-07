/**
 * Structured output expected from a remote provider: a semantic graph without
 * layout. It is validated with Zod, normalised into a full document, checked
 * against the referential invariants and laid out before any preview.
 */
import { z } from 'zod';
import { defaultPorts } from '../../domain/commands';
import { validateInvariants } from '../../domain/invariants';
import { deriveNarrative } from '../../domain/narrative';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_NODE_SIZE,
  type DiagramDocument,
  GROUP_KINDS,
  NODE_KINDS,
  RELATION_KINDS,
  SCHEMA_VERSION,
  type StyleId,
} from '../../domain/types';
import { GENERATION_LIMITS, GenerationError } from './types';

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const label = z.string().trim().min(1).max(120);

export const generatedGraphSchema = z.object({
  name: label,
  description: z.string().max(2_000).default(''),
  groups: z
    .array(
      z.object({ id, label, kind: z.enum(GROUP_KINDS).default('domain'), parentGroupId: id.nullable().default(null) }),
    )
    .max(GENERATION_LIMITS.maxGroups)
    .default([]),
  nodes: z
    .array(
      z.object({
        id,
        kind: z.enum(NODE_KINDS),
        label,
        description: z.string().max(2_000).optional(),
        provider: z.string().max(120).optional(),
        groupId: id.nullable().default(null),
      }),
    )
    .min(1)
    .max(GENERATION_LIMITS.maxNodes),
  edges: z
    .array(
      z.object({
        id,
        source: id,
        target: id,
        relation: z.enum(RELATION_KINDS),
        label: z.string().max(120).optional(),
        order: z.number().int().min(1).max(999).optional(),
        explanation: z.string().max(2_000).optional(),
        bidirectional: z.boolean().optional(),
      }),
    )
    .max(GENERATION_LIMITS.maxEdges),
});

export type GeneratedGraph = z.infer<typeof generatedGraphSchema>;

/**
 * Turns untrusted provider output into a document with a provisional layout.
 * Throws a typed error (never mutates anything) when the output is invalid.
 */
export function graphToDocument(raw: unknown, styleId: StyleId): DiagramDocument {
  const parsed = generatedGraphSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(
      'invalid-output',
      'La respuesta del proveedor no cumple el esquema.',
      parsed.error.issues
        .slice(0, 30)
        .map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    );
  }
  const graph = parsed.data;
  const layout: DiagramDocument['layout'] = { nodes: {}, groups: {}, annotations: {} };
  // Provisional grid; the real layout is computed by ELK before preview.
  graph.nodes.forEach((node, index) => {
    layout.nodes[node.id] = { x: (index % 6) * 240, y: Math.floor(index / 6) * 160, ...DEFAULT_NODE_SIZE };
  });
  graph.groups.forEach((group) => {
    layout.groups[group.id] = { x: 0, y: 0, width: 320, height: 200 };
  });
  const edges = graph.edges.map((edge) => ({
    id: edge.id,
    source: { nodeId: edge.source, portId: 'p-right' },
    target: { nodeId: edge.target, portId: 'p-left' },
    relation: edge.relation,
    direction: edge.bidirectional ? ('bidirectional' as const) : ('forward' as const),
    ...(edge.label ? { label: edge.label } : {}),
    ...(edge.order !== undefined ? { order: edge.order } : {}),
    ...(edge.explanation ? { explanation: edge.explanation } : {}),
  }));
  const document: DiagramDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: `gen-${Date.now().toString(36)}`,
    name: graph.name,
    description: graph.description,
    groups: graph.groups,
    nodes: graph.nodes.map((node) => ({ ...node, ports: defaultPorts(), metadata: {} })),
    edges,
    annotations: [],
    layout,
    presentation: { styleId, camera: { projection: 'style' }, appearance: { ...DEFAULT_APPEARANCE } },
    narrative: { steps: deriveNarrative({ edges }) },
  };
  const issues = validateInvariants(document);
  if (issues.length > 0)
    throw new GenerationError(
      'invalid-output',
      'La respuesta tiene referencias inválidas (IDs duplicados, extremos inexistentes o grupos cíclicos).',
      issues,
    );
  return document;
}
