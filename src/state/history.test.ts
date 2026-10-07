import { beforeEach, describe, expect, it } from 'vitest';
import * as cmd from '../domain/commands';
import { TEMPLATES } from '../features/templates';
import { appearanceVariant } from './actions';
import { useDocumentStore } from './documentStore';

const store = () => useDocumentStore.getState();

describe('history', () => {
  beforeEach(() => store().load(TEMPLATES[0]!.create()));

  it('undo and redo restore exact documents', () => {
    const original = store().doc;
    expect(store().execute('Renombrar', (doc) => cmd.updateNode(doc, 'n-api', { label: 'API v2' })).ok).toBe(true);
    const renamed = store().doc;
    store().undo();
    expect(store().doc).toBe(original);
    store().redo();
    expect(store().doc).toBe(renamed);
  });

  it('a complete multi-node drag is one entry', () => {
    const moves: cmd.Move[] = [
      { type: 'node', id: 'n-launcher', x: 60, y: 70 },
      { type: 'node', id: 'n-runner', x: 300, y: 70 },
    ];
    store().execute('Mover', (doc) => cmd.moveElements(doc, moves));
    expect(store().past).toHaveLength(1);
  });

  it('a new edit invalidates redo', () => {
    store().execute('A', (doc) => cmd.updateNode(doc, 'n-api', { label: 'A' }));
    store().undo();
    expect(store().future).toHaveLength(1);
    store().execute('B', (doc) => cmd.updateNode(doc, 'n-api', { label: 'B' }));
    expect(store().future).toHaveLength(0);
  });

  it('rejected commands do not mutate the document or history', () => {
    const before = store().doc;
    const result = store().execute('Ciclo', (doc) => cmd.setGroupParent(doc, 'g-region', 'g-cluster'));
    expect(result.ok).toBe(false);
    expect(store().doc).toBe(before);
    expect(store().past).toHaveLength(0);
  });

  it('appearance variants are seeded and keep the graph', () => {
    const doc = store().doc;
    expect(appearanceVariant(doc, 9)).toEqual(appearanceVariant(doc, 9));
    expect(appearanceVariant(doc, 9).styleId).not.toBe(doc.presentation.styleId);
    const variant = appearanceVariant(doc, 9);
    store().execute('Apariencia', (d) =>
      cmd.setPresentation(d, { styleId: variant.styleId, appearance: { layerHeight: variant.layerHeight } }),
    );
    expect(store().doc.nodes).toBe(doc.nodes);
    expect(store().doc.edges).toBe(doc.edges);
    expect(store().doc.groups).toBe(doc.groups);
  });
});
