/**
 * Performance fixture: 100 nodes / 150 edges in 10 groups, deterministic.
 * Loaded with `?stress=1`; it is a measurement aid, not an architecture.
 */
import { NODE_KINDS } from '../../domain/types';
import { DiagramBuilder } from './builder';
import { createRng } from './random';

export function stressDocument(nodeCount = 100, edgeCount = 150) {
  const rng = createRng(2024);
  const b = new DiagramBuilder({
    id: 'fixture-stress',
    name: `Rendimiento ${nodeCount}/${edgeCount}`,
    description: 'Documento sintético para medir rendimiento (no representa una arquitectura).',
    styleId: 'porcelain',
  });
  const perGroup = 10;
  const groups = Math.ceil(nodeCount / perGroup);
  const ids: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    const groupId = `g-${g}`;
    b.group(groupId, `Dominio ${g + 1}`);
    const col0 = (g % 5) * 2.6;
    const row0 = Math.floor(g / 5) * 5.8;
    for (let i = 0; i < perGroup && ids.length < nodeCount; i += 1) {
      const id = `n-${ids.length}`;
      b.node(
        id,
        NODE_KINDS[ids.length % NODE_KINDS.length] ?? 'service',
        `Componente ${ids.length + 1}`,
        [col0 + (i % 2), row0 + Math.floor(i / 2)],
        { group: groupId },
      );
      ids.push(id);
    }
  }
  const pairs = new Set<string>();
  // A spanning chain first so every node is connected, then seeded extra edges.
  for (let i = 1; i < ids.length && pairs.size < edgeCount; i += 1) pairs.add(`${ids[i - 1]}>${ids[i]}`);
  while (pairs.size < edgeCount) {
    const a = rng.pick(ids);
    const c = rng.pick(ids);
    if (a !== c) pairs.add(`${a}>${c}`);
  }
  let order = 0;
  for (const pair of pairs) {
    const [from, to] = pair.split('>') as [string, string];
    b.edge(
      from,
      to,
      rng.pick(['request', 'data', 'event', 'telemetry'] as const),
      undefined,
      order < 12 ? { order: ++order } : {},
    );
  }
  return b.build();
}
