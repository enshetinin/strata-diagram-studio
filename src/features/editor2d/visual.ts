/**
 * 2D visual vocabulary shared by the React Flow editor and the SVG exporter,
 * so the exported file looks like the editor.
 */
import type { NodeKind, RelationKind } from '../../domain/types';

/** Generic geometric glyphs on a 20×20 grid (stroke only). Not vendor logos. */
export const KIND_GLYPH: Record<NodeKind, string> = {
  client: 'M10 3.2a3.1 3.1 0 1 0 0 6.2a3.1 3.1 0 1 0 0-6.2 M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5',
  human: 'M8 3.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0-5.6 M2.5 16.5c0-3 2.4-5 5.5-5c1.2 0 2.3.3 3.2.8 M12 15l2 2 3.5-4',
  device: 'M6 6h8v8H6z M8.5 8.5h3v3h-3z M8 3v3 M12 3v3 M8 14v3 M12 14v3 M3 8h3 M3 12h3 M14 8h3 M14 12h3',
  frontend: 'M3 4h14v12H3z M3 7.5h14',
  mobile: 'M6 2.5h8v15H6z M8.5 15h3',
  api: 'M10 2.5 16.5 6.25v7.5L10 17.5 3.5 13.75v-7.5Z',
  service: 'M4 4h12v12H4z M4 8.5h12',
  container: 'M2.5 6h15v9h-15z M5.5 6v9 M8.5 6v9 M11.5 6v9 M14.5 6v9',
  vm: 'M3 3.5h14v4H3z M3 8h14v4H3z M3 12.5h14v4H3z M5.5 5.5h.5 M5.5 10h.5 M5.5 14.5h.5',
  function: 'M10 3 17 16H3Z',
  scheduler: 'M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M10 6v4l3 2',
  workflow: 'M2.5 13h4v4h-4z M8 8h4v4H8z M13.5 3h4v4h-4z M6.5 15h3.5v-3 M12 10h3.5V7',
  database:
    'M4 5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5v10c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5Z M4 5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5',
  vector:
    'M3.5 16.5V3.5 M3.5 16.5h13 M7 11.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0 M11.5 7a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0 M12.5 12.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0',
  search: 'M3.5 8.5a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12.2 12.2 16.5 16.5',
  warehouse: 'M2.5 16.5h15 M3.5 16.5v-4h13v4 M5.5 12.5v-4h9v4 M7.5 8.5v-5h5v5',
  storage: 'M3 9h14v7H3z M5 9 6.5 4h7L15 9',
  document: 'M5 2.5h7l3.5 3.5v11.5H5Z M12 2.5V6h3.5 M7.5 10h5 M7.5 13h5',
  registry: 'M3 3v14 M17 3v14 M3 9.5h14 M3 16h14 M5 9.5V6h3.5v3.5 M10 9.5V5.5h3.5v4 M6 16v-3.5h3.5V16',
  repo: 'M5.5 6.2v8.8 M14.5 8.2c0 4-9 2.6-9 6.8 M3.8 4.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M3.8 16.7a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M12.8 6.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0',
  queue: 'M2.5 7h4v6h-4z M8 7h4v6H8z M13.5 7h4v6h-4z',
  stream: 'M2.5 5h15 M2.5 10h15 M2.5 15h15 M12 3.5v3 M15 3.5v3 M9 8.5v3 M13 8.5v3 M14.5 13.5v3',
  notification: 'M2.5 6h11v9.5h-11z M2.5 6l5.5 5 5.5-5 M14 4.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  cache: 'M11 2 4 11h5l-1 7 7-9h-5z',
  agent: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M10 6.5 13.5 10 10 13.5 6.5 10Z',
  model: 'M10 2.5 17 7v6l-7 4.5L3 13V7Z M3 7l7 4 7-4 M10 11v6.5',
  guardrail: 'M4 4v13 M10 4v13 M16 4v13 M2.5 6.5h15 M2.5 11h15',
  tool: 'M3.5 16.5 10 10 M11.5 3.5a4 4 0 1 0 5 5l-2.2-.3-.5-2-2-.5Z',
  notebook: 'M10 5.5C8 4 5.5 3.8 3 4.5v11c2.5-.7 5-.5 7 1 2-1.5 4.5-1.7 7-1v-11c-2.5-.7-5-.5-7 1Z M10 5.5v11',
  gateway: 'M4 17V8a6 6 0 0 1 12 0v9 M7.5 17v-7a2.5 2.5 0 0 1 5 0v7',
  balancer: 'M8 2.5h4v4H8z M10 6.5v10 M10 9 4 16.5 M10 9l6 7.5',
  cdn: 'M7.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M10 7.5V4.5 M10 12.5v3 M7.5 10h-3 M12.5 10h3 M9 3.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M9 16.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M2.5 10a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M15.5 10a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  dns: 'M10 2.5v15 M10 4h6l1.5 1.75L16 7.5h-6 M10 9.5H4l-1.5 1.75L4 13h6',
  firewall: 'M2.5 4h15v12h-15z M2.5 8h15 M2.5 12h15 M7 4v4 M13 4v4 M10 8v4 M5.5 12v4 M14.5 12v4',
  identity:
    'M3 4.5h14v11H3z M5.5 13c.4-1.2 1.2-1.8 2.3-1.8s1.9.6 2.3 1.8 M6.4 8.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0 M12 8.5h3 M12 11.5h3',
  secret: 'M3.5 10a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0 M10.5 10h6.5 M14.5 10v2.5 M17 10v2',
  observability: 'M2.5 10h4l2-5 3 10 2-5h4',
  external: 'M3 6.5V3h3.5 M13.5 3H17v3.5 M17 13.5V17h-3.5 M6.5 17H3v-3.5 M8 12l5-5 M9 7h4v4',
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
  auth: { color: '#4B5E8A', dash: '8 3 2 3' },
  stream: { color: '#2F6B63' },
  replication: { color: '#2F4A5E', dash: '10 4' },
  sync: { color: '#2F4A5E', dash: '4 2' },
  backup: { color: '#6B7280', dash: '8 3 2 3' },
  deploy: { color: '#9A7A1F', dash: '5 3' },
};
