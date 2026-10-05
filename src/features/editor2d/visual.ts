/**
 * 2D visual vocabulary shared by the React Flow editor and the SVG exporter,
 * so the exported file looks like the editor.
 */
import type { NodeKind, RelationKind } from '../../domain/types';

/** Generic geometric glyphs on a 20×20 grid (stroke only). Not vendor logos. */
export const KIND_GLYPH: Record<NodeKind, string> = {
  client: 'M10 3.2a3.1 3.1 0 1 0 0 6.2a3.1 3.1 0 1 0 0-6.2 M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5',
  frontend: 'M3 4h14v12H3z M3 7.5h14',
  api: 'M10 2.5 16.5 6.25v7.5L10 17.5 3.5 13.75v-7.5Z',
  service: 'M4 4h12v12H4z M4 8.5h12',
  function: 'M10 3 17 16H3Z',
  database: 'M4 5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5v10c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5Z M4 5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5',
  storage: 'M3 9h14v7H3z M5 9 6.5 4h7L15 9',
  queue: 'M2.5 7h4v6h-4z M8 7h4v6H8z M13.5 7h4v6h-4z',
  cache: 'M11 2 4 11h5l-1 7 7-9h-5z',
  agent: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M10 6.5 13.5 10 10 13.5 6.5 10Z',
  model: 'M10 2.5 17 7v6l-7 4.5L3 13V7Z M3 7l7 4 7-4 M10 11v6.5',
  tool: 'M3.5 16.5 10 10 M11.5 3.5a4 4 0 1 0 5 5l-2.2-.3-.5-2-2-.5Z',
  gateway: 'M4 17V8a6 6 0 0 1 12 0v9 M7.5 17v-7a2.5 2.5 0 0 1 5 0v7',
  observability: 'M2.5 10h4l2-5 3 10 2-5h4',
  generic: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12',
};

/** Domain accents for 2D group headers (same family as the Porcelain preset). */
export const ACCENTS_2D = ['#C2532A', '#2F6B63', '#9A7A1F', '#4B5E8A', '#7A4C73'];

export function accent2d(index: number): string {
  return index < 0 ? '#8A93A3' : (ACCENTS_2D[index % ACCENTS_2D.length] ?? '#8A93A3');
}

export const RELATION_STROKE: Record<RelationKind, { color: string; dash?: string }> = {
  request: { color: '#0D1B2E' },
  response: { color: '#0D1B2E', dash: '2 4' },
  data: { color: '#2F4A5E' },
  event: { color: '#0D1B2E', dash: '7 4' },
  async: { color: '#0D1B2E', dash: '7 4' },
  dependency: { color: '#6B7280', dash: '3 3' },
  telemetry: { color: '#6B7280', dash: '1 3' },
  control: { color: '#9A3412' },
};

