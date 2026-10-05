import { DiagramBuilder } from '../builder';

/** Left-to-right stages; the lakehouse nests a medallion band one layer deeper. */
export function dataPlatform() {
  return new DiagramBuilder({
    id: 'tpl-data-platform',
    name: 'Plataforma de datos',
    description:
      'Fuentes operacionales y eventos entran por streaming y lotes, se procesan hacia un lakehouse por capas y se sirven desde un warehouse a BI y notebooks. Ejemplo ilustrativo.',
    styleId: 'blueprint',
    appearance: { layerHeight: 0.6 },
  })
    .group('g-sources', 'Fuentes', { kind: 'zone' })
    .group('g-ingest', 'Ingesta', { kind: 'lane' })
    .group('g-process', 'Procesamiento', { kind: 'lane' })
    .group('g-lake', 'Lakehouse', { kind: 'region' })
    .group('g-medallion', 'Capas medallion', { kind: 'lane', parent: 'g-lake' })
    .group('g-warehouse', 'Warehouse', { kind: 'zone' })
    .group('g-consume', 'Consumo', { kind: 'zone' })
    .node('n-appdb', 'database', 'BD operacional', [0, 0.5], { group: 'g-sources' })
    .node('n-saas', 'api', 'API SaaS (CRM)', [0, 1.6], { group: 'g-sources' })
    .node('n-clicks', 'frontend', 'Clickstream web', [0, 2.7], { group: 'g-sources' })
    .node('n-cdc', 'service', 'Captura CDC', [1.4, 0.5], { group: 'g-ingest' })
    .node('n-connector', 'function', 'Conector programado', [1.4, 1.6], { group: 'g-ingest' })
    .node('n-collector', 'service', 'Colector de eventos', [1.4, 2.7], { group: 'g-ingest' })
    .node('n-stream', 'queue', 'Topics de streaming', [2.4, 1.6], { group: 'g-ingest' })
    .node('n-streamproc', 'service', 'Procesador streaming', [3.8, 0.9], { group: 'g-process' })
    .node('n-batch', 'function', 'Jobs batch', [3.8, 2.3], { group: 'g-process' })
    .node('n-quality', 'observability', 'Calidad de datos', [3.8, 3.5], { group: 'g-process' })
    .node('n-bronze', 'storage', 'Bronze', [5.3, 0.5], { group: 'g-medallion' })
    .node('n-silver', 'storage', 'Silver', [5.3, 1.6], { group: 'g-medallion' })
    .node('n-gold', 'storage', 'Gold', [5.3, 2.7], { group: 'g-medallion' })
    .node('n-catalog', 'tool', 'Catálogo', [6.35, 1.6], { group: 'g-lake' })
    .node('n-warehouse', 'database', 'Data warehouse', [7.8, 1.6], { group: 'g-warehouse' })
    .node('n-bi', 'frontend', 'Dashboards BI', [9.2, 0.9], { group: 'g-consume' })
    .node('n-notebooks', 'tool', 'Notebooks y ML', [9.2, 2.3], { group: 'g-consume' })
    .edge('n-appdb', 'n-cdc', 'data', 'Binlog', { order: 1 })
    .edge('n-cdc', 'n-stream', 'event', 'Cambios', { order: 2, fromSide: 'right', toSide: 'top' })
    .edge('n-clicks', 'n-collector', 'event', 'Eventos web', { order: 3 })
    .edge('n-collector', 'n-stream', 'event', undefined, { order: 3, fromSide: 'right', toSide: 'bottom' })
    .edge('n-saas', 'n-connector', 'data', 'Extracción diaria', { order: 4 })
    .edge('n-stream', 'n-streamproc', 'event', 'Consumo', { order: 5 })
    .edge('n-streamproc', 'n-bronze', 'data', 'Raw', { order: 6 })
    .edge('n-connector', 'n-bronze', 'data', 'Carga batch', { order: 6, fromSide: 'top', toSide: 'left' })
    .edge('n-bronze', 'n-batch', 'data', 'Lee bronze', { order: 7, fromSide: 'bottom', toSide: 'right' })
    .edge('n-batch', 'n-silver', 'data', 'Limpia y deduplica', { order: 8 })
    .edge('n-batch', 'n-gold', 'data', 'Agrega', { order: 9 })
    .edge('n-gold', 'n-warehouse', 'data', 'Modelos servidos', { order: 10 })
    .edge('n-bi', 'n-warehouse', 'request', 'SQL', { order: 11 })
    .edge('n-gold', 'n-notebooks', 'data', 'Features', { order: 12, fromSide: 'bottom', toSide: 'bottom' })
    .edge('n-silver', 'n-quality', 'telemetry', 'Expectativas', { fromSide: 'bottom', toSide: 'right' })
    .edge('n-catalog', 'n-silver', 'dependency', 'Esquemas')
    .build();
}
