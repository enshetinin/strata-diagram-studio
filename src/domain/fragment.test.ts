import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../features/templates';
import { extractFragment, parseClipboardText, pasteFragment } from './fragment';
import { resolveAbsoluteLayout } from './geometry';
import { validateInvariants } from './invariants';
import { serializeDocument } from './parse';
import type { DiagramDocument, ElementRef } from './types';

const aws = () => TEMPLATES[0]!.create();
const rag = () => TEMPLATES.find((template) => template.id === 'rag')!.create();

/** A nested group (has a parent) with at least one node inside. */
function nestedGroup(doc: DiagramDocument) {
  return doc.groups.find(
    (group) => group.parentGroupId !== null && doc.nodes.some((node) => node.groupId === group.id),
  )!;
}

describe('clipboard fragments', () => {
  it('copies a group with its descendants and internal relations', () => {
    const doc = aws();
    const top = doc.groups.find((group) => group.parentGroupId === null)!;
    const fragment = extractFragment(doc, [{ type: 'group', id: top.id }])!;
    expect(fragment.groups.map((group) => group.id)).toContain(top.id);
    const nodeIds = new Set(fragment.nodes.map((node) => node.id));
    expect(fragment.edges.every((edge) => nodeIds.has(edge.source.nodeId) && nodeIds.has(edge.target.nodeId))).toBe(
      true,
    );
    expect(fragment.groups.find((group) => group.id === top.id)!.parentGroupId).toBeNull();
  });

  it('returns null when only relations are selected', () => {
    const doc = aws();
    expect(extractFragment(doc, [{ type: 'edge', id: doc.edges[0]!.id }])).toBeNull();
  });

  it('round-trips through clipboard text', () => {
    const doc = aws();
    const fragment = extractFragment(doc, [{ type: 'node', id: doc.nodes[0]!.id }])!;
    const parsed = parseClipboardText(JSON.stringify(fragment));
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') expect(parsed.fragment).toEqual(fragment);
  });

  it('ignores unrelated text and rejects tampered fragments', () => {
    expect(parseClipboardText('hola').status).toBe('none');
    expect(parseClipboardText('{"a":1}').status).toBe('none');
    const doc = aws();
    const fragment = extractFragment(doc, [{ type: 'node', id: doc.nodes[0]!.id }])!;
    const tampered = { ...fragment, nodes: [{ ...fragment.nodes[0]!, kind: 'spaceship' }] };
    expect(parseClipboardText(JSON.stringify(tampered)).status).toBe('invalid');
  });

  it('accepts a whole document as pasted text', () => {
    const source = rag();
    const parsed = parseClipboardText(serializeDocument(source));
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.fragment.nodes).toHaveLength(source.nodes.length);
      expect(parsed.fragment.edges).toHaveLength(source.edges.length);
    }
  });

  it('pastes with fresh ids, keeps invariants and clears walkthrough order', () => {
    const doc = aws();
    const refs: ElementRef[] = doc.groups
      .filter((group) => group.parentGroupId === null)
      .map((group) => ({ type: 'group', id: group.id }));
    const fragment = extractFragment(doc, refs)!;
    const { doc: next, roots } = pasteFragment(doc, fragment, { containerId: null, offset: { x: 32, y: 32 } });
    expect(validateInvariants(next)).toEqual([]);
    expect(next.nodes).toHaveLength(doc.nodes.length + fragment.nodes.length);
    expect(next.edges).toHaveLength(doc.edges.length + fragment.edges.length);
    const originalIds = new Set([...doc.nodes, ...doc.groups, ...doc.edges].map((element) => element.id));
    expect(roots.every((ref) => !originalIds.has(ref.id))).toBe(true);
    expect(next.edges.slice(doc.edges.length).every((edge) => edge.order === undefined)).toBe(true);
    expect(next.narrative).toEqual(doc.narrative);
  });

  it('keeps absolute positions plus the offset when pasting into the original container', () => {
    const doc = aws();
    const group = nestedGroup(doc);
    const node = doc.nodes.find((candidate) => candidate.groupId === group.id)!;
    const fragment = extractFragment(doc, [{ type: 'node', id: node.id }])!;
    const { doc: next, roots } = pasteFragment(doc, fragment, { containerId: group.id, offset: { x: 32, y: 32 } });
    const pasted = next.nodes.find((candidate) => candidate.id === roots[0]!.id)!;
    expect(pasted.groupId).toBe(group.id);
    const before = resolveAbsoluteLayout(doc).nodes.get(node.id)!;
    const after = resolveAbsoluteLayout(next).nodes.get(pasted.id)!;
    expect(after.x - before.x).toBe(32);
    expect(after.y - before.y).toBe(32);
  });

  it('places the fragment top-left at an absolute point inside another group', () => {
    const doc = aws();
    const target = nestedGroup(doc);
    const targetRect = resolveAbsoluteLayout(doc).groups.get(target.id)!;
    const fragment = extractFragment(doc, [{ type: 'node', id: doc.nodes[0]!.id }])!;
    const at = { x: targetRect.x + 40, y: targetRect.y + 60 };
    const { doc: next, roots } = pasteFragment(doc, fragment, { containerId: target.id, at });
    expect(validateInvariants(next)).toEqual([]);
    const rect = resolveAbsoluteLayout(next).nodes.get(roots[0]!.id)!;
    expect({ x: rect.x, y: rect.y }).toEqual(at);
    expect(next.nodes.find((node) => node.id === roots[0]!.id)!.groupId).toBe(target.id);
  });

  it('pastes into another document', () => {
    const source = aws();
    const target = rag();
    const fragment = extractFragment(
      source,
      source.groups.map((group) => ({ type: 'group' as const, id: group.id })),
    )!;
    const { doc: next } = pasteFragment(target, fragment, { containerId: null, at: { x: 2000, y: 0 } });
    expect(validateInvariants(next)).toEqual([]);
    expect(next.groups).toHaveLength(target.groups.length + source.groups.length);
  });
});
