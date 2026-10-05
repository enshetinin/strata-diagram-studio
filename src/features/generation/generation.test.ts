import { describe, expect, it } from 'vitest';
import { validateInvariants } from '../../domain/invariants';
import { graphToDocument } from './generatedGraph';
import { LocalRuleGenerator } from './localGenerator';
import { suggestTemplates } from './suggest';
import { GenerationError } from './types';

const graph = {
  name: 'Pipeline',
  description: 'test',
  groups: [{ id: 'g-a', label: 'A', kind: 'domain', parentGroupId: null }],
  nodes: [
    { id: 'n-1', kind: 'api', label: 'API', groupId: 'g-a' },
    { id: 'n-2', kind: 'database', label: 'DB', groupId: null },
  ],
  edges: [{ id: 'e-1', source: 'n-1', target: 'n-2', relation: 'data', label: 'SQL', order: 1 }],
};

describe('remote output validation', () => {
  it('normalises a valid graph into a full document', () => {
    const doc = graphToDocument(graph, 'porcelain');
    expect(validateInvariants(doc)).toEqual([]);
    expect(doc.nodes[0]?.ports).toHaveLength(4);
    expect(doc.narrative.steps).toHaveLength(1);
  });

  it('rejects duplicate ids, missing endpoints and cyclic groups with typed errors', () => {
    const cases = [
      { ...graph, nodes: [...graph.nodes, { id: 'n-1', kind: 'tool', label: 'dup', groupId: null }] },
      { ...graph, edges: [{ ...graph.edges[0]!, target: 'ghost' }] },
      {
        ...graph,
        groups: [
          { id: 'g-a', label: 'A', kind: 'domain', parentGroupId: 'g-b' },
          { id: 'g-b', label: 'B', kind: 'domain', parentGroupId: 'g-a' },
        ],
      },
    ];
    for (const raw of cases) {
      expect(() => graphToDocument(raw, 'porcelain')).toThrow(GenerationError);
      try {
        graphToDocument(raw, 'porcelain');
      } catch (error) {
        expect((error as GenerationError).code).toBe('invalid-output');
        expect((error as GenerationError).issues.length).toBeGreaterThan(0);
      }
    }
  });

  it('rejects schema violations and oversize output', () => {
    expect(() => graphToDocument({ ...graph, nodes: [{ id: 'bad id!', kind: 'api', label: 'x' }] }, 'porcelain')).toThrow(GenerationError);
    const many = Array.from({ length: 81 }, (_, index) => ({ id: `n-${index}`, kind: 'service', label: `S${index}`, groupId: null }));
    expect(() => graphToDocument({ ...graph, groups: [], nodes: many, edges: [] }, 'porcelain')).toThrow(GenerationError);
    // HTML/script in labels is kept as inert text, never interpreted.
    const doc = graphToDocument({ ...graph, nodes: [{ ...graph.nodes[0]!, label: '<img src=x onerror=alert(1)>' }, graph.nodes[1]!] }, 'porcelain');
    expect(doc.nodes[0]?.label).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('local generator', () => {
  it('is deterministic, honours cancellation and refuses free text', async () => {
    const generator = new LocalRuleGenerator();
    const request = { mode: 'rules', category: 'iot', seed: 5, complexity: 2 } as const;
    const a = await generator.generate(request, new AbortController().signal);
    const b = await generator.generate(request, new AbortController().signal);
    expect(a.document).toEqual(b.document);
    expect(a.provider.kind).toBe('local');
    const aborted = new AbortController();
    aborted.abort();
    await expect(generator.generate(request, aborted.signal)).rejects.toMatchObject({ code: 'cancelled' });
    await expect(generator.generate({ mode: 'prompt', prompt: 'hola' }, new AbortController().signal)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('keyword suggestions only point at compatible examples', () => {
    expect(suggestTemplates('pipeline con Kafka, pagos e inventario')[0]?.category).toBe('events');
    expect(suggestTemplates('sensores MQTT en planta')[0]?.category).toBe('iot');
    expect(suggestTemplates('xyz')).toEqual([]);
  });
});
