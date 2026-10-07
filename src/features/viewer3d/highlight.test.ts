import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';
import { computeHighlight } from './highlight';

const doc = TEMPLATES[0]!.create();

describe('3D emphasis', () => {
  it('highlights neighbours of the selected node and dims the rest', () => {
    const state = computeHighlight(doc, [{ type: 'node', id: 'n-runner' }], null, null);
    expect(state.node('n-runner')).toBe('selected');
    expect(state.node('n-worker-1')).toBe('related');
    expect(state.node('n-qa')).toBe('dimmed');
  });

  it('isolating a group hides everything outside it, including nested descendants', () => {
    const state = computeHighlight(doc, [], 'g-region', null);
    expect(state.node('n-worker-2')).toBe('normal');
    expect(state.node('n-console')).toBe('isolatedOut');
    expect(state.group('g-cluster')).toBe('normal');
    expect(state.group('g-access')).toBe('isolatedOut');
  });

  it('narrated steps drive the active edges and ignore the editing selection', () => {
    const state = computeHighlight(doc, [{ type: 'node', id: 'n-qa' }], null, 0);
    expect(state.activeEdges).toEqual(['e-n-qa-n-console']);
    expect(state.node('n-console')).toBe('related');
    expect(state.node('n-qa')).toBe('related');
    expect(state.node('n-runner')).toBe('dimmed');
  });

  it('a selected note emphasises the node it points at; a free note dims nothing', () => {
    const withNotes = {
      ...doc,
      annotations: [
        { id: 'a-1', text: 'Escala horizontal', targetNodeId: 'n-runner' },
        { id: 'a-2', text: 'Libre', targetNodeId: null },
      ],
      layout: { ...doc.layout, annotations: { 'a-1': { x: 0, y: -200, width: 200, height: 96 }, 'a-2': { x: 300, y: -200, width: 200, height: 96 } } },
    };
    const pointed = computeHighlight(withNotes, [{ type: 'annotation', id: 'a-1' }], null, null);
    expect(pointed.node('n-runner')).toBe('related');
    expect(pointed.node('n-qa')).toBe('dimmed');
    const free = computeHighlight(withNotes, [{ type: 'annotation', id: 'a-2' }], null, null);
    expect(free.node('n-qa')).toBe('normal');
  });
});
