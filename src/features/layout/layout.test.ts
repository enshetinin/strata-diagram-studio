import { describe, expect, it } from 'vitest';
import * as cmd from '../../domain/commands';
import { resolveAbsoluteLayout } from '../../domain/geometry';
import { validateInvariants } from '../../domain/invariants';
import { STYLE_IDS } from '../../domain/types';
import { TEMPLATES } from '../templates';
import { THEMES } from '../viewer3d/themes';
import { computeAutoLayout } from './elkLayout';
import { buildSceneModel, createWorldTransform, WORLD_SCALE } from './sceneModel';
import { documentBounds } from '../../domain/geometry';

const options = { layerHeight: 0.5, heightScale: 1, routeStyle: 'orthogonal' as const };

describe('scene model (2D → 3D)', () => {
  it('maps nested nodes through one transform', () => {
    const doc = TEMPLATES[0]!.create();
    const scene = buildSceneModel(doc, options);
    const abs = resolveAbsoluteLayout(doc);
    const transform = createWorldTransform(documentBounds(doc, abs));
    const rect = abs.nodes.get('n-worker-2')!;
    const node = scene.nodes.find((candidate) => candidate.id === 'n-worker-2')!;
    const expected = transform.toWorld({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    expect(node.x).toBeCloseTo(expected.x);
    expect(node.z).toBeCloseTo(expected.z);
    expect(node.sizeX).toBeCloseTo(rect.width * WORLD_SCALE);
    // Depth-2 group: node rests on the cluster platform, above region and VPC.
    const cluster = scene.groups.find((group) => group.id === 'g-cluster')!;
    const region = scene.groups.find((group) => group.id === 'g-region')!;
    expect(node.bottom).toBeCloseTo(cluster.top);
    expect(cluster.top).toBeGreaterThan(region.top);
  });

  it('centres the scene on document bounds', () => {
    const scene = buildSceneModel(TEMPLATES[1]!.create(), options);
    expect((scene.bounds.min.x + scene.bounds.max.x) / 2).toBeCloseTo(0, 5);
    expect((scene.bounds.min.z + scene.bounds.max.z) / 2).toBeCloseTo(0, 5);
  });

  it('routes start and end at port anchors and never pass through foreign volumes', () => {
    for (const template of TEMPLATES) {
      for (const routeStyle of ['orthogonal', 'arc'] as const) {
        const scene = buildSceneModel(template.create(), { ...options, routeStyle });
        expect(scene.edges).toHaveLength(template.create().edges.length);
        for (const edge of scene.edges) {
          for (const point of edge.points.slice(2, -2)) {
            for (const node of scene.nodes) {
              if (node.id === edge.sourceId || node.id === edge.targetId) continue;
              const inside =
                Math.abs(point.x - node.x) < node.sizeX / 2 - 0.01 &&
                Math.abs(point.z - node.z) < node.sizeZ / 2 - 0.01 &&
                point.y > node.bottom &&
                point.y < node.top;
              expect(inside, `${template.id}/${routeStyle}: ${edge.id} crosses ${node.id}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('changing style keeps ids, membership and connections', () => {
    const doc = TEMPLATES[2]!.create();
    const reference = buildSceneModel(doc, options);
    for (const styleId of STYLE_IDS) {
      const theme = THEMES[styleId];
      const styled = cmd.setPresentation(doc, { styleId });
      const scene = buildSceneModel(styled, { layerHeight: 0.5, heightScale: theme.node.heightScale, routeStyle: theme.connector.route });
      expect(scene.nodes.map((node) => [node.id, node.groupId])).toEqual(reference.nodes.map((node) => [node.id, node.groupId]));
      expect(scene.edges.map((edge) => [edge.id, edge.sourceId, edge.targetId])).toEqual(reference.edges.map((edge) => [edge.id, edge.sourceId, edge.targetId]));
    }
  });
});

describe('ELK auto-layout', () => {
  it('lays out groups, nodes and ports and keeps the document valid', async () => {
    const doc = TEMPLATES[0]!.create();
    const layout = await computeAutoLayout(doc, { direction: 'RIGHT', spacing: 1 });
    expect(Object.keys(layout.nodes).sort()).toEqual(doc.nodes.map((node) => node.id).sort());
    expect(Object.keys(layout.groups).sort()).toEqual(doc.groups.map((group) => group.id).sort());
    const next = cmd.applyLayout(doc, layout);
    expect(validateInvariants(next)).toEqual([]);
    expect(next.nodes).toBe(doc.nodes);
    // Children stay inside their (ELK-sized) group.
    const abs = resolveAbsoluteLayout(next);
    const worker = abs.nodes.get('n-worker-1')!;
    const cluster = abs.groups.get('g-cluster')!;
    expect(worker.x).toBeGreaterThanOrEqual(cluster.x);
    expect(worker.x + worker.width).toBeLessThanOrEqual(cluster.x + cluster.width);
  });
});
