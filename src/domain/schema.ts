import { z } from 'zod';
import {
  EDGE_DIRECTIONS,
  GROUP_KINDS,
  LABEL_MODES,
  NODE_KINDS,
  PORT_DATA_TYPES,
  PORT_DIRECTIONS,
  PORT_SIDES,
  RELATION_KINDS,
  SCHEMA_VERSION,
  STYLE_IDS,
  type DiagramDocument,
  type JsonValue,
} from './types';

/** Hard limits for anything that enters from outside (import, storage, generation). */
export const LIMITS = {
  maxBytes: 2_000_000,
  maxNodes: 400,
  maxEdges: 800,
  maxGroups: 120,
  maxPortsPerNode: 24,
  maxLabel: 120,
  maxText: 2_000,
  maxMetadataBytes: 4_000,
  maxIdLength: 80,
} as const;

const id = z
  .string()
  .min(1)
  .max(LIMITS.maxIdLength)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'Los IDs solo admiten letras, números y . _ : -');

const label = z.string().trim().min(1).max(LIMITS.maxLabel);
const text = z.string().max(LIMITS.maxText);
const finite = z.number(); // Zod 4 rejects Infinity and NaN by default.

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string().max(LIMITS.maxText), finite, z.boolean(), z.null(), z.array(jsonValue).max(100), z.record(z.string().max(80), jsonValue)]),
);

const metadata = z
  .record(z.string().max(80), jsonValue)
  .refine((value) => JSON.stringify(value).length <= LIMITS.maxMetadataBytes, 'Metadatos demasiado grandes');

export const portSchema = z.object({
  id,
  side: z.enum(PORT_SIDES),
  direction: z.enum(PORT_DIRECTIONS),
  dataType: z.enum(PORT_DATA_TYPES),
  label: z.string().max(LIMITS.maxLabel).optional(),
});

export const nodeSchema = z.object({
  id,
  kind: z.enum(NODE_KINDS),
  label,
  description: text.optional(),
  provider: z.string().max(LIMITS.maxLabel).optional(),
  ports: z.array(portSchema).min(1).max(LIMITS.maxPortsPerNode),
  groupId: id.nullable(),
  metadata,
});

export const groupSchema = z.object({
  id,
  label,
  description: text.optional(),
  kind: z.enum(GROUP_KINDS),
  parentGroupId: id.nullable(),
});

const endpoint = z.object({ nodeId: id, portId: id });

export const edgeSchema = z.object({
  id,
  source: endpoint,
  target: endpoint,
  relation: z.enum(RELATION_KINDS),
  label: z.string().max(LIMITS.maxLabel).optional(),
  direction: z.enum(EDGE_DIRECTIONS),
  order: z.number().int().min(1).max(999).optional(),
  explanation: text.optional(),
});

const rect = z.object({
  x: finite.min(-1e6).max(1e6),
  y: finite.min(-1e6).max(1e6),
  width: finite.min(8).max(1e5),
  height: finite.min(8).max(1e5),
});

export const documentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  name: label,
  description: text,
  nodes: z.array(nodeSchema).max(LIMITS.maxNodes),
  groups: z.array(groupSchema).max(LIMITS.maxGroups),
  edges: z.array(edgeSchema).max(LIMITS.maxEdges),
  layout: z.object({
    nodes: z.record(id, rect),
    groups: z.record(id, rect),
  }),
  presentation: z.object({
    styleId: z.enum(STYLE_IDS),
    camera: z.object({ projection: z.enum(['style', 'orthographic', 'perspective']) }),
    appearance: z.object({
      spacing: finite.min(0.6).max(1.8),
      layerHeight: finite.min(0).max(2),
      labelMode: z.enum(LABEL_MODES),
      flowParticles: z.boolean(),
    }),
  }),
  narrative: z.object({
    steps: z
      .array(
        z.object({
          id,
          title: label,
          caption: text.optional(),
          edgeIds: z.array(id).max(LIMITS.maxEdges),
        }),
      )
      .max(200),
  }),
});

// Compile-time guarantee that the schema and the TypeScript model agree.
type SchemaDocument = z.infer<typeof documentSchema>;
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const schemaMatchesModel: AssertEqual<SchemaDocument, DiagramDocument> = true;
