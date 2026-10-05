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
});
