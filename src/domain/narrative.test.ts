import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../features/templates';
import * as cmd from './commands';
import { validateInvariants } from './invariants';
import { effectiveNarrative } from './narrative';
import type { DiagramDocument } from './types';

const aws = () => TEMPLATES[0]!.create();
const orderOf = (doc: DiagramDocument, id: string) => doc.edges.find((edge) => edge.id === id)!.order;

/** A document that only declares `edge.order`, as older imports do. */
function legacy(): DiagramDocument {
  const doc = aws();
  return { ...doc, narrative: { steps: [] } };
}

describe('walkthrough editing', () => {
  it('materializes steps from edge order on the first edit', () => {
    const doc = legacy();
    const derived = effectiveNarrative(doc);
    const next = cmd.updateStep(doc, derived[0]!.id, { caption: 'Contexto' });
    expect(next.narrative.steps).toHaveLength(derived.length);
    expect(next.narrative.steps[0]!.caption).toBe('Contexto');
    expect(validateInvariants(next)).toEqual([]);
  });

  it('drops the baked "1. " prefix from titles', () => {
    const doc = aws();
    const steps = doc.narrative.steps.map((step, index) => ({ ...step, title: `${index + 1}. ${step.title}` }));
    const next = cmd.updateStep({ ...doc, narrative: { steps } }, steps[1]!.id, { caption: 'x' });
    expect(next.narrative.steps.every((step) => !/^\d+\.\s/.test(step.title))).toBe(true);
  });

  it('renumbers edge markers when steps move', () => {
    const doc = aws();
    const [first, second] = doc.narrative.steps;
    const next = cmd.moveStep(doc, first!.id, 1);
    expect(next.narrative.steps[0]!.id).toBe(second!.id);
    expect(orderOf(next, first!.edgeIds[0]!)).toBe(2);
    expect(orderOf(next, second!.edgeIds[0]!)).toBe(1);
  });

  it('keeps a relation in a single step and clears its marker when removed', () => {
    const doc = aws();
    const edge = doc.narrative.steps[0]!.edgeIds[0]!;
    const target = doc.narrative.steps[2]!.id;
    const moved = cmd.setEdgeStep(doc, edge, target);
    expect(moved.narrative.steps.filter((step) => step.edgeIds.includes(edge))).toHaveLength(1);
    expect(orderOf(moved, edge)).toBe(3);
    const out = cmd.setEdgeStep(moved, edge, null);
    expect(out.narrative.steps.some((step) => step.edgeIds.includes(edge))).toBe(false);
    expect(orderOf(out, edge)).toBeUndefined();
  });

  it('adds intro steps without relations and removes steps', () => {
    const doc = aws();
    const id = cmd.nextStepId(doc);
    const withIntro = cmd.addStep(doc, { id, title: 'Visión general', index: 0 });
    expect(withIntro.narrative.steps[0]!.edgeIds).toEqual([]);
    expect(orderOf(withIntro, doc.narrative.steps[0]!.edgeIds[0]!)).toBe(2);
    const removed = cmd.removeStep(withIntro, id);
    expect(removed.narrative.steps).toEqual(doc.narrative.steps.map((step) => ({ ...step })));
  });

  it('a new step claims its relations from previous steps', () => {
    const doc = aws();
    const edge = doc.narrative.steps[0]!.edgeIds[0]!;
    const next = cmd.addStep(doc, { id: cmd.nextStepId(doc), title: 'Nuevo', edgeIds: [edge] });
    expect(next.narrative.steps.filter((step) => step.edgeIds.includes(edge))).toHaveLength(1);
    expect(orderOf(next, edge)).toBe(next.narrative.steps.length);
  });

  it('deleting a relation drops the step it emptied but keeps intro steps', () => {
    const doc = cmd.addStep(aws(), { id: 'intro', title: 'Intro', index: 0 });
    const target = doc.narrative.steps.find((step) => step.edgeIds.length === 1)!;
    const next = cmd.deleteElements(doc, [{ type: 'edge', id: target.edgeIds[0]! }]);
    expect(next.narrative.steps.some((step) => step.id === target.id)).toBe(false);
    expect(next.narrative.steps[0]!.id).toBe('intro');
    expect(validateInvariants(next)).toEqual([]);
    next.narrative.steps.forEach((step, index) =>
      step.edgeIds.forEach((id) => expect(orderOf(next, id)).toBe(index + 1)),
    );
  });

  it('rejects empty titles and unknown steps', () => {
    const doc = aws();
    expect(() => cmd.updateStep(doc, doc.narrative.steps[0]!.id, { title: '  ' })).toThrow(cmd.CommandError);
    expect(() => cmd.moveStep(doc, 'ghost', 0)).toThrow(cmd.CommandError);
  });
});
