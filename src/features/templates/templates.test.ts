import { describe, expect, it } from 'vitest';
import { rectsOverlap, resolveAbsoluteLayout } from '../../domain/geometry';
import { validateInvariants } from '../../domain/invariants';
import { type DiagramDocument, type Rect, STYLE_IDS } from '../../domain/types';
import { TEMPLATE_CATEGORIES, TEMPLATES } from './index';
import { type Complexity, generateVariation } from './variations';

/** Sibling elements (same container) must not overlap; children must sit inside their container. */
function compositionProblems(doc: DiagramDocument): string[] {
  const abs = resolveAbsoluteLayout(doc);
  const problems: string[] = [];
  const containers = new Set<string | null>([null, ...doc.groups.map((group) => group.id)]);
  for (const container of containers) {
    const siblings: [string, Rect][] = [
      ...doc.nodes
        .filter((node) => node.groupId === container)
        .map((node) => [node.id, abs.nodes.get(node.id)!] as [string, Rect]),
      ...doc.groups
        .filter((group) => group.parentGroupId === container)
        .map((group) => [group.id, abs.groups.get(group.id)!] as [string, Rect]),
    ];
    for (let i = 0; i < siblings.length; i += 1) {
      for (let j = i + 1; j < siblings.length; j += 1) {
        const [aId, a] = siblings[i]!;
        const [bId, b] = siblings[j]!;
        if (rectsOverlap(a, b, 8)) problems.push(`${aId} overlaps ${bId}`);
      }
      if (container) {
        const [id, rect] = siblings[i]!;
        const parent = abs.groups.get(container)!;
        const inside =
          rect.x >= parent.x &&
          rect.y >= parent.y &&
          rect.x + rect.width <= parent.x + parent.width &&
          rect.y + rect.height <= parent.y + parent.height;
        if (!inside) problems.push(`${id} outside ${container}`);
      }
    }
  }
  return problems;
}

describe('templates', () => {
  it('has six templates with distinct categories and recommended styles', () => {
    expect(TEMPLATES).toHaveLength(6);
    expect(new Set(TEMPLATES.map((template) => template.category)).size).toBe(6);
    expect(new Set(TEMPLATES.map((template) => template.recommendedStyle))).toEqual(new Set(STYLE_IDS));
  });

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    '%s is valid and well composed',
    (_id, template) => {
      const doc = template.create();
      expect(validateInvariants(doc)).toEqual([]);
      expect(compositionProblems(doc)).toEqual([]);
      expect(doc.narrative.steps.length).toBeGreaterThan(3);
    },
  );

  it('topologies differ (node kinds and group structure)', () => {
    const signatures = TEMPLATES.map((template) => {
      const doc = template.create();
      return `${doc.nodes.length}:${doc.edges.length}:${doc.groups.length}:${doc.nodes
        .map((node) => node.kind)
        .sort()
        .join(',')}`;
    });
    expect(new Set(signatures).size).toBe(6);
  });
});

describe('rule-based variations', () => {
  it('are deterministic per seed', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const a = generateVariation({ category, seed: 42, complexity: 2 });
      const b = generateVariation({ category, seed: 42, complexity: 2 });
      expect(a).toEqual(b);
    }
  });

  it('change with the seed', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const signatures = new Set(
        [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
          const doc = generateVariation({ category, seed, complexity: 3 });
          return doc.nodes.map((node) => node.label).join('|') + doc.edges.length;
        }),
      );
      expect(signatures.size, category).toBeGreaterThan(1);
    }
  });

  it('are valid and overlap-free across seeds and complexities', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      for (const complexity of [1, 2, 3] as Complexity[]) {
        for (let seed = 1; seed <= 25; seed += 1) {
          const doc = generateVariation({ category, seed, complexity });
          const label = `${category} c${complexity} s${seed}`;
          expect(validateInvariants(doc), label).toEqual([]);
          expect(compositionProblems(doc), label).toEqual([]);
        }
      }
    }
  });
});

describe('performance fixture', () => {
  it('has exactly 100 nodes / 150 edges and is valid', async () => {
    const { stressDocument } = await import('./stress');
    const doc = stressDocument();
    expect(doc.nodes).toHaveLength(100);
    expect(doc.edges).toHaveLength(150);
    expect(validateInvariants(doc)).toEqual([]);
    expect(compositionProblems(doc)).toEqual([]);
  });
});
