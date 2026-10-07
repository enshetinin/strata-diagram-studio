import { describe, expect, it } from 'vitest';
import { addAnnotation } from '../../domain/commands';
import { parseDocumentText, serializeDocument } from '../../domain/parse';
import { DiagramBuilder } from '../templates/builder';
import { documentToSvg } from './svg';

function boundaryDocument() {
  return new DiagramBuilder({ id: 'svg-boundary', name: 'Límite', description: '', styleId: 'porcelain' })
    .group('g-public', 'Internet', { kind: 'boundary' })
    .group('g-prod', 'Producción', { kind: 'environment' })
    .node('n-user', 'client', 'Usuario', [0, 0], { group: 'g-public' })
    .node('n-idp', 'identity', 'Identidad', [2, 0], { group: 'g-prod' })
    .node('n-db', 'database', 'Primaria', [3, 0], { group: 'g-prod' })
    .node('n-replica', 'database', 'Réplica', [3, 1], { group: 'g-prod' })
    .edge('n-user', 'n-idp', 'auth', 'Login')
    .edge('n-db', 'n-replica', 'replication')
    .build();
}

describe('new group and relation kinds', () => {
  it('round-trip through the document schema', () => {
    const doc = boundaryDocument();
    const parsed = parseDocumentText(serializeDocument(doc));
    expect(parsed.ok).toBe(true);
  });

  it('draw a trust boundary as an unfilled dashed frame, other groups tinted', () => {
    const svg = documentToSvg(boundaryDocument());
    const frames = [...svg.matchAll(/<g data-group="([^"]+)">\s*<rect ([^>]+)\/>/g)].map(([, id, attrs]) => ({
      id,
      attrs,
    }));
    expect(frames.find((frame) => frame.id === 'g-public')?.attrs).toContain('fill="none"');
    expect(frames.find((frame) => frame.id === 'g-public')?.attrs).toContain('stroke-dasharray');
    expect(frames.find((frame) => frame.id === 'g-prod')?.attrs).not.toContain('stroke-dasharray');
    expect(svg).toContain('ENTORNO');
    expect(svg).toContain('url(#arrow-ink)');
  });

  it('exports notes with their leader line above the components', () => {
    const doc = addAnnotation(boundaryDocument(), {
      id: 'a-1',
      text: 'Solo con MFA',
      position: { x: 0, y: -200 },
      targetNodeId: 'n-idp',
    });
    const svg = documentToSvg(doc);
    const note = svg.slice(svg.indexOf('<g data-annotation="a-1">'));
    expect(svg.indexOf('<g data-annotation')).toBeGreaterThan(svg.lastIndexOf('<g data-node'));
    expect(note).toContain('stroke-dasharray="3 3"');
    expect(note).toContain('Solo con MFA');
  });
});
