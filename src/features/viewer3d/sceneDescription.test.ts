import { describe, expect, it } from 'vitest';
import { DiagramBuilder } from '../templates/builder';
import { describeScene } from './sceneDescription';

describe('scene text alternative', () => {
  it('lists components by group and relations in walkthrough order', () => {
    const doc = new DiagramBuilder({ id: 'd', name: 'D', description: '', styleId: 'porcelain' })
      .group('g-edge', 'Borde')
      .group('g-api', 'API', { parent: 'g-edge' })
      .node('n-user', 'client', 'Usuario', [0, 0])
      .node('n-gw', 'gateway', 'Gateway', [1, 0], { group: 'g-api' })
      .node('n-db', 'database', 'Pedidos', [2, 0])
      .edge('n-gw', 'n-db', 'data', 'Guardar', { order: 2 })
      .edge('n-user', 'n-gw', 'request', undefined, { order: 1 })
      .build();
    const description = describeScene(doc);
    expect(description.ungrouped).toEqual(['Usuario (cliente)', 'Pedidos (base de datos)']);
    expect(description.groups.find((group) => group.id === 'g-api')).toMatchObject({
      depth: 1,
      components: ['Gateway (gateway)'],
    });
    expect(description.relations.map((relation) => relation.text)).toEqual([
      '1. Usuario → Gateway (petición)',
      '2. Gateway → Pedidos (datos: Guardar)',
    ]);
  });
});
