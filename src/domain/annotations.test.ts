import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../features/templates';
import * as cmd from './commands';
import { extractFragment, pasteFragment } from './fragment';
import { findFreeSpot, leaderLine, resolveAbsoluteLayout } from './geometry';
import { validateInvariants } from './invariants';
import { parseDocument, parseDocumentText, serializeDocument } from './parse';
import type { DiagramDocument } from './types';

const aws = () => TEMPLATES[0]!.create();

function withNote(doc: DiagramDocument, targetNodeId: string | null = 'n-runner'): DiagramDocument {
  return cmd.addAnnotation(doc, {
    id: 'a-1',
    text: '  Escala con la cola  ',
    position: { x: 40, y: -160 },
    targetNodeId,
  });
}

describe('annotations', () => {
  it('documents saved before notes existed still parse, with none', () => {
    const legacy = JSON.parse(serializeDocument(aws())) as Record<string, unknown> & {
      layout: Record<string, unknown>;
    };
    delete legacy.annotations;
    delete legacy.layout.annotations;
    const parsed = parseDocument(legacy);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.annotations).toEqual([]);
      expect(parsed.document.layout.annotations).toEqual({});
    }
  });

  it('adds a trimmed note that round-trips and keeps the document valid', () => {
    const doc = withNote(aws());
    expect(doc.annotations).toEqual([{ id: 'a-1', text: 'Escala con la cola', targetNodeId: 'n-runner' }]);
    expect(validateInvariants(doc)).toEqual([]);
    const parsed = parseDocumentText(serializeDocument(doc));
    expect(parsed.ok && parsed.document.annotations).toEqual(doc.annotations);
  });

  it('rejects empty text, unknown targets and duplicate ids', () => {
    expect(() => cmd.addAnnotation(aws(), { id: 'a-1', text: '   ', position: { x: 0, y: 0 } })).toThrow(
      cmd.CommandError,
    );
    expect(() =>
      cmd.addAnnotation(aws(), { id: 'a-1', text: 'x', position: { x: 0, y: 0 }, targetNodeId: 'ghost' }),
    ).toThrow(cmd.CommandError);
    expect(() => cmd.addAnnotation(aws(), { id: 'n-runner', text: 'x', position: { x: 0, y: 0 } })).toThrow(
      cmd.CommandError,
    );
    expect(() => cmd.updateAnnotation(withNote(aws()), 'a-1', { text: '' })).toThrow(cmd.CommandError);
  });

  it('flags dangling targets and orphan layout as invariant issues', () => {
    const doc = withNote(aws());
    const dangling = { ...doc, annotations: [{ ...doc.annotations[0]!, targetNodeId: 'ghost' }] };
    expect(validateInvariants(dangling).some((issue) => issue.path === 'annotations[0].targetNodeId')).toBe(true);
    const orphan = { ...doc, annotations: [] };
    expect(validateInvariants(orphan).some((issue) => issue.path === 'layout.annotations.a-1')).toBe(true);
  });

  it('keeps the note but drops its leader when the target node is deleted', () => {
    const next = cmd.deleteElements(withNote(aws()), [{ type: 'node', id: 'n-runner' }]);
    expect(next.annotations[0]?.targetNodeId).toBeNull();
    expect(validateInvariants(next)).toEqual([]);
  });

  it('deletes, moves and resizes notes like any element', () => {
    const doc = withNote(aws());
    const moved = cmd.moveElements(doc, [{ type: 'annotation', id: 'a-1', x: 400, y: 20.6 }]);
    expect(moved.layout.annotations['a-1']).toMatchObject({ x: 400, y: 21 });
    const resized = cmd.resizeElement(doc, { type: 'annotation', id: 'a-1' }, { x: 0, y: 0, width: 10, height: 10 });
    expect(resized.layout.annotations['a-1']).toMatchObject({ width: 120, height: 48 });
    const removed = cmd.deleteElements(doc, [{ type: 'annotation', id: 'a-1' }]);
    expect(removed.annotations).toEqual([]);
    expect(removed.layout.annotations).toEqual({});
  });

  it('auto-layout carries a pointing note along with its node; free notes stay', () => {
    const doc = cmd.addAnnotation(withNote(aws()), { id: 'a-2', text: 'Libre', position: { x: 900, y: -160 } });
    const layout = structuredClone(doc.layout);
    const runner = layout.nodes['n-runner']!;
    runner.x += 300;
    runner.y += 50;
    const next = cmd.applyLayout(doc, layout);
    expect(next.layout.annotations['a-1']).toMatchObject({ x: 340, y: -110 });
    expect(next.layout.annotations['a-2']).toMatchObject({ x: 900, y: -160 });
  });

  it('copies notes with remapped targets; a target left behind is dropped', () => {
    const doc = withNote(aws());
    const withTarget = extractFragment(doc, [
      { type: 'annotation', id: 'a-1' },
      { type: 'node', id: 'n-runner' },
    ])!;
    const pasted = pasteFragment(doc, withTarget, { containerId: null, offset: { x: 40, y: 40 } });
    const copy = pasted.doc.annotations.find((annotation) => annotation.id !== 'a-1')!;
    const copiedNode = pasted.roots.find((ref) => ref.type === 'node')!;
    expect(copy.targetNodeId).toBe(copiedNode.id);
    expect(pasted.doc.layout.annotations[copy.id]).toMatchObject({ x: 80, y: -120 });
    expect(validateInvariants(pasted.doc)).toEqual([]);

    const alone = pasteFragment(doc, extractFragment(doc, [{ type: 'annotation', id: 'a-1' }])!, {
      containerId: null,
      offset: { x: 40, y: 40 },
    });
    expect(alone.doc.annotations.at(-1)?.targetNodeId).toBeNull();
  });

  it('draws the leader between the two borders, and nothing when they overlap', () => {
    const note = { x: 0, y: 0, width: 100, height: 50 };
    const line = leaderLine(note, { x: 300, y: 0, width: 100, height: 50 });
    expect(line).toEqual({ from: { x: 100, y: 25 }, to: { x: 300, y: 25 } });
    expect(leaderLine(note, { x: 50, y: 20, width: 100, height: 50 })).toBeNull();
    expect(resolveAbsoluteLayout(withNote(aws())).annotations.get('a-1')).toMatchObject({ x: 40, y: -160 });
  });

  it('finds the nearest free spot for a new note, upwards first', () => {
    const size = { width: 100, height: 50 };
    const blocker = { x: 0, y: 0, width: 100, height: 50 };
    expect(findFreeSpot({ x: 500, y: 500 }, size, [blocker])).toEqual({ x: 500, y: 500 });
    expect(findFreeSpot({ x: 0, y: 0 }, size, [blocker], 10)).toEqual({ x: 0, y: -60 });
  });
});
