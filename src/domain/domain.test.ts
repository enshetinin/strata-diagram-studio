import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../features/templates';
import * as cmd from './commands';
import { resolveAbsoluteLayout } from './geometry';
import { checkConnection, validateInvariants } from './invariants';
import { parseDocument, parseDocumentText, serializeDocument } from './parse';
import type { DiagramDocument } from './types';

const aws = () => TEMPLATES[0]!.create();

function semantic(doc: DiagramDocument) {
  return { nodes: doc.nodes, groups: doc.groups, edges: doc.edges };
}

describe('schema and invariants', () => {
  it('accepts every template', () => {
    for (const template of TEMPLATES) {
      const result = parseDocument(JSON.parse(serializeDocument(template.create())));
      expect(result.ok, `${template.id}: ${result.ok ? '' : JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it('round-trips JSON without changes', () => {
    const doc = aws();
    const result = parseDocumentText(serializeDocument(doc));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document).toEqual(doc);
  });

  it('rejects duplicate ids', () => {
    const doc = aws();
    const broken = { ...doc, nodes: [...doc.nodes, { ...doc.nodes[0]! }] };
    const result = parseDocument(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.message.includes('duplicado'))).toBe(true);
  });

  it('rejects edges to missing nodes and ports', () => {
    const doc = aws();
    const edge = doc.edges[0]!;
    expect(
      validateInvariants({ ...doc, edges: [{ ...edge, target: { nodeId: 'ghost', portId: 'p-left' } }] }).length,
    ).toBeGreaterThan(0);
    expect(
      validateInvariants({ ...doc, edges: [{ ...edge, target: { ...edge.target, portId: 'nope' } }] }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects incompatible ports', () => {
    const doc = aws();
    const [a, b] = doc.nodes;
    const typed: DiagramDocument = {
      ...doc,
      nodes: doc.nodes.map((node) =>
        node.id === a!.id
          ? { ...node, ports: [{ id: 'in-only', side: 'right', direction: 'in', dataType: 'event' }] }
          : node.id === b!.id
            ? { ...node, ports: [{ id: 'data-in', side: 'left', direction: 'in', dataType: 'data' }] }
            : node,
      ),
      edges: [],
      narrative: { steps: [] },
    };
    const check = checkConnection(typed, { nodeId: a!.id, portId: 'in-only' }, { nodeId: b!.id, portId: 'data-in' });
    expect(check.ok).toBe(false);
  });

  it('rejects group membership cycles but allows edge cycles', () => {
    const doc = aws();
    const cyclic = {
      ...doc,
      groups: doc.groups.map((group) => (group.id === 'g-region' ? { ...group, parentGroupId: 'g-cluster' } : group)),
    };
    expect(validateInvariants(cyclic).some((issue) => issue.message.includes('Ciclo'))).toBe(true);
    const multi = TEMPLATES.find((template) => template.id === 'multi-agent')!.create();
    expect(validateInvariants(multi)).toEqual([]);
    expect(multi.edges.some((edge) => edge.source.nodeId === 'n-reviewer' && edge.target.nodeId === 'n-coder')).toBe(
      true,
    );
  });

  it('refuses unknown schema versions explicitly', () => {
    const result = parseDocument({ ...aws(), schemaVersion: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unknown-version');
    const missing = parseDocument({ name: 'x' });
    expect(!missing.ok && missing.code).toBe('missing-version');
  });

  it('enforces size limits before parsing', () => {
    const result = parseDocumentText(' '.repeat(2_000_001));
    expect(!result.ok && result.code).toBe('too-large');
  });
});

describe('nested group coordinates', () => {
  it('resolves absolute positions recursively without double offsets', () => {
    const doc = aws();
    const abs = resolveAbsoluteLayout(doc);
    const region = doc.layout.groups['g-region']!;
    const vpc = doc.layout.groups['g-vpc']!;
    const cluster = doc.layout.groups['g-cluster']!;
    const worker = doc.layout.nodes['n-worker-1']!;
    expect(abs.nodes.get('n-worker-1')).toMatchObject({
      x: region.x + vpc.x + cluster.x + worker.x,
      y: region.y + vpc.y + cluster.y + worker.y,
    });
    expect(abs.groupDepth.get('g-cluster')).toBe(2);
  });
});

describe('commands', () => {
  it('deleting a node removes its edges in the same transaction', () => {
    const doc = aws();
    const next = cmd.deleteElements(doc, [{ type: 'node', id: 'n-runner' }]);
    expect(next.nodes.some((node) => node.id === 'n-runner')).toBe(false);
    expect(next.edges.some((edge) => edge.source.nodeId === 'n-runner' || edge.target.nodeId === 'n-runner')).toBe(
      false,
    );
    expect(validateInvariants(next)).toEqual([]);
  });

  it('deleting a group keeps children at their absolute positions by default', () => {
    const doc = aws();
    const before = resolveAbsoluteLayout(doc);
    const next = cmd.deleteElements(doc, [{ type: 'group', id: 'g-vpc' }]);
    const after = resolveAbsoluteLayout(next);
    expect(next.groups.find((group) => group.id === 'g-cluster')?.parentGroupId).toBe('g-region');
    expect(after.nodes.get('n-worker-2')).toEqual(before.nodes.get('n-worker-2'));
    expect(after.groups.get('g-cluster')).toEqual(before.groups.get('g-cluster'));
    expect(validateInvariants(next)).toEqual([]);
  });

  it('deleting a group with contents is explicit', () => {
    const next = cmd.deleteElements(aws(), [{ type: 'group', id: 'g-vpc' }], { groupContents: 'delete' });
    expect(next.nodes.some((node) => node.id.startsWith('n-worker'))).toBe(false);
    expect(next.groups.map((group) => group.id)).not.toContain('g-cluster');
    expect(validateInvariants(next)).toEqual([]);
  });

  it('groups and ungroups preserving absolute positions', () => {
    const doc = aws();
    const before = resolveAbsoluteLayout(doc);
    const grouped = cmd.groupElements(doc, { id: 'g-new', label: 'Nuevo', nodeIds: ['n-launcher', 'n-runner'] });
    expect(grouped.groups.find((group) => group.id === 'g-new')?.parentGroupId).toBe('g-orchestration');
    expect(resolveAbsoluteLayout(grouped).nodes.get('n-runner')).toEqual(before.nodes.get('n-runner'));
    const ungrouped = cmd.ungroup(grouped, 'g-new');
    expect(resolveAbsoluteLayout(ungrouped).nodes.get('n-runner')).toEqual(before.nodes.get('n-runner'));
    expect(() => cmd.groupElements(doc, { id: 'g-x', label: 'x', nodeIds: ['n-qa', 'n-runner'] })).toThrow(
      cmd.CommandError,
    );
  });

  it('rejects reparenting that would create a membership cycle', () => {
    expect(() => cmd.setGroupParent(aws(), 'g-region', 'g-cluster')).toThrow(/ciclo/);
  });

  it('duplicates nodes with internal edges and fresh ids', () => {
    const doc = aws();
    const { doc: next, ids } = cmd.duplicateNodes(doc, ['n-launcher', 'n-runner']);
    expect(ids).toHaveLength(2);
    expect(
      next.edges.filter((edge) => ids.includes(edge.source.nodeId) && ids.includes(edge.target.nodeId)),
    ).toHaveLength(1);
    expect(validateInvariants(next)).toEqual([]);
  });

  it('removing a port drops the edges that used it', () => {
    const doc = aws();
    const node = doc.nodes.find((candidate) => candidate.id === 'n-api')!;
    const next = cmd.setNodePorts(
      doc,
      'n-api',
      node.ports.filter((port) => port.id !== 'p-right'),
    );
    expect(next.edges.some((edge) => edge.source.nodeId === 'n-api' && edge.source.portId === 'p-right')).toBe(false);
    expect(validateInvariants(next)).toEqual([]);
  });

  it('moving a node outside its group grows the group', () => {
    const doc = aws();
    const group = doc.layout.groups['g-access']!;
    const next = cmd.moveElements(doc, [{ type: 'node', id: 'n-api', x: group.width + 200, y: 40 }]);
    const grown = next.layout.groups['g-access']!;
    expect(grown.width).toBeGreaterThan(group.width);
  });

  it('presentation changes never touch semantics', () => {
    const doc = aws();
    const next = cmd.setPresentation(doc, { styleId: 'blueprint', appearance: { layerHeight: 1.2 } });
    expect(semantic(next)).toEqual(semantic(doc));
    expect(next.presentation.styleId).toBe('blueprint');
  });
});
