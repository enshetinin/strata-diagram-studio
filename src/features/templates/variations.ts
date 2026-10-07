/**
 * Local rule-based architecture generator ("Nueva arquitectura").
 *
 * Each category has explicit topology rules; a seed picks among valid options
 * and the complexity (1–3) scales the number of components. Same input → same
 * document. It does not understand free text.
 */
import type { AppearanceSettings, NodeKind, StyleId } from '../../domain/types';
import { DiagramBuilder } from './builder';
import type { TemplateCategory } from './index';
import { createRng, type Rng } from './random';

export type Complexity = 1 | 2 | 3;

export interface VariationRequest {
  category: TemplateCategory;
  seed: number;
  complexity: Complexity;
  styleId?: StyleId;
}

interface Item {
  id: string;
  kind: NodeKind;
  label: string;
}

/** Stacks items vertically in one grid column, centred on `centerRow`. */
function stack(b: DiagramBuilder, items: Item[], col: number, centerRow: number, group?: string) {
  items.forEach((item, index) => {
    b.node(item.id, item.kind, item.label, [col, centerRow - (items.length - 1) / 2 + index], group ? { group } : {});
  });
}

const STAGE_GAP = 1.45;

function loadTesting(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const workers = rng.int(1 + complexity, 2 + complexity);
  const withAuth = complexity > 1 || rng.chance(0.5);
  const tool = rng.pick(['k6', 'JMeter', 'Locust', 'Gatling']);
  b.group('g-access', 'Frontend y API')
    .group('g-orchestration', 'Orquestación')
    .group('g-region', 'Región · ejecución', { kind: 'region' });
  b.group('g-vpc', 'VPC', { kind: 'network', parent: 'g-region' }).group('g-cluster', `Workers ${tool}`, {
    kind: 'cluster',
    parent: 'g-vpc',
  });
  const mid = (workers - 1) / 2;
  b.node('n-qa', 'client', 'Equipo de QA', [0, mid]);
  stack(
    b,
    [
      { id: 'n-console', kind: 'frontend', label: 'Consola de pruebas' },
      ...(withAuth ? [{ id: 'n-auth', kind: 'service' as const, label: 'Autenticación' }] : []),
    ],
    1.2,
    mid,
    'g-access',
  );
  b.node('n-api', 'api', 'API de pruebas', [2.2, mid], { group: 'g-access' });
  const orchestrator = rng.pick(['Task runner', 'Orquestador de ejecuciones', 'Planificador de carga']);
  stack(
    b,
    [
      { id: 'n-runner', kind: 'service', label: orchestrator },
      { id: 'n-scenarios', kind: 'database', label: 'Escenarios' },
    ],
    2.2 + STAGE_GAP + 0.1,
    mid,
    'g-orchestration',
  );
  const workerItems: Item[] = Array.from({ length: workers }, (_, index) => ({
    id: `n-worker-${index + 1}`,
    kind: 'service',
    label: `Worker ${String.fromCharCode(65 + index)}`,
  }));
  const workerCol = 3.75 + STAGE_GAP + 0.35;
  stack(b, workerItems, workerCol, mid, 'g-cluster');
  stack(
    b,
    [
      { id: 'n-metrics', kind: 'observability', label: 'Métricas' },
      { id: 'n-results', kind: 'storage', label: 'Resultados' },
    ],
    workerCol + 1.3,
    mid,
    'g-region',
  );
  b.node('n-target', 'generic', 'Sistema bajo prueba', [workerCol + 2.8, mid]);
  b.edge('n-qa', 'n-console', 'request', 'Configura', { order: 1 });
  if (withAuth) b.edge('n-console', 'n-auth', 'request', 'Login');
  b.edge('n-console', 'n-api', 'request', 'HTTPS', { order: 2 });
  b.edge('n-api', 'n-runner', 'request', 'Crear ejecución', { order: 3 });
  b.edge('n-runner', 'n-scenarios', 'data', 'Lee escenario', { order: 4 });
  workerItems.forEach((worker, index) => {
    b.edge('n-runner', worker.id, 'control', index === 0 ? 'Lanza' : undefined, { order: 5 });
    b.edge(worker.id, 'n-target', 'request', index === 0 ? 'Carga' : undefined, { order: 6 });
  });
  b.edge(workerItems[0]?.id ?? 'n-worker-1', 'n-metrics', 'telemetry', 'Métricas', { order: 7 });
  b.edge('n-runner', 'n-results', 'data', 'Informe', { order: 8 });
}

function rag(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const sourcePool: Item[] = [
    { id: 'n-src-pdf', kind: 'storage', label: 'PDFs y manuales' },
    { id: 'n-src-wiki', kind: 'api', label: 'Wiki interna' },
    { id: 'n-src-tickets', kind: 'database', label: 'Tickets de soporte' },
    { id: 'n-src-web', kind: 'frontend', label: 'Sitio público' },
  ];
  const sources = rng.sample(sourcePool, Math.min(sourcePool.length, complexity + rng.int(0, 1)));
  const reranker = complexity >= 2 || rng.chance(0.4);
  const hybrid = complexity === 3 || rng.chance(0.3);
  const cache = rng.chance(0.5 + complexity * 0.15);
  b.group('g-ingest', 'Ingesta', { kind: 'lane' }).group('g-query', 'Consulta', { kind: 'lane' });
  stack(b, sources, 0, 0, 'g-ingest');
  const topRow = (sources.length - 1) / 2 + 0.6;
  const ingest: Item[] = [
    { id: 'n-parser', kind: 'function', label: rng.pick(['Parsing y chunking', 'Extracción y troceado']) },
    { id: 'n-embed-job', kind: 'function', label: 'Generador de embeddings' },
    { id: 'n-index', kind: 'database', label: 'Índice vectorial' },
  ];
  ingest.forEach((item, index) => b.node(item.id, item.kind, item.label, [1 + index, 0], { group: 'g-ingest' }));
  if (hybrid) b.node('n-keyword', 'database', 'Índice léxico', [3, 1], { group: 'g-ingest' });
  const queryRow = Math.max(topRow, hybrid ? 1 : 0) + 2.4;
  b.node('n-embedder', 'model', 'Modelo de embeddings', [2, queryRow - 1.2]);
  b.node('n-user', 'client', 'Usuario', [-1.3, queryRow]);
  const query: Item[] = [
    { id: 'n-chat', kind: 'frontend', label: 'Chat' },
    { id: 'n-api', kind: 'api', label: 'API de consulta' },
    { id: 'n-retriever', kind: 'service', label: hybrid ? 'Retriever híbrido' : 'Retriever' },
    ...(reranker ? [{ id: 'n-reranker', kind: 'model' as const, label: 'Re-ranker' }] : []),
    { id: 'n-llm', kind: 'model', label: 'LLM generador' },
  ];
  query.forEach((item, index) => b.node(item.id, item.kind, item.label, [index, queryRow], { group: 'g-query' }));
  if (cache) b.node('n-cache', 'cache', 'Caché semántica', [1, queryRow + 1.2], { group: 'g-query' });
  let order = 1;
  sources.forEach((source) => b.edge(source.id, 'n-parser', 'data', undefined, { order }));
  b.edge('n-parser', 'n-embed-job', 'data', 'Fragmentos', { order: ++order });
  b.edge('n-embed-job', 'n-embedder', 'request', 'Vectoriza', { order: ++order, fromSide: 'bottom', toSide: 'top' });
  b.edge('n-embed-job', 'n-index', 'data', 'Upsert', { order: ++order });
  if (hybrid) b.edge('n-parser', 'n-keyword', 'data', 'Términos', { fromSide: 'bottom', toSide: 'left' });
  b.edge('n-user', 'n-chat', 'request', 'Pregunta', { order: ++order });
  b.edge('n-chat', 'n-api', 'request', undefined, { order: ++order });
  if (cache) b.edge('n-api', 'n-cache', 'request', 'Caché', { direction: 'bidirectional' });
  b.edge('n-api', 'n-retriever', 'request', 'Recupera', { order: ++order });
  b.edge('n-retriever', 'n-embedder', 'request', 'Embedding', { order: ++order, fromSide: 'top', toSide: 'bottom' });
  b.edge('n-retriever', 'n-index', 'request', 'Top-k', { order: ++order, fromSide: 'top', toSide: 'bottom' });
  if (hybrid) b.edge('n-retriever', 'n-keyword', 'request', 'BM25', { order, fromSide: 'top', toSide: 'bottom' });
  const contextSource = reranker ? 'n-reranker' : 'n-retriever';
  if (reranker) b.edge('n-retriever', 'n-reranker', 'data', 'Candidatos', { order: ++order });
  b.edge(contextSource, 'n-llm', 'data', 'Contexto', { order: ++order });
  b.edge('n-llm', 'n-api', 'response', 'Respuesta con citas', { order: ++order, fromSide: 'bottom', toSide: 'bottom' });
}

function multiAgent(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const pool = [
    { id: 'n-research', label: 'Investigador', tool: 'Búsqueda web' },
    { id: 'n-coder', label: 'Programador', tool: 'Sandbox de código' },
    { id: 'n-analyst', label: 'Analista de datos', tool: 'Consulta SQL' },
    { id: 'n-writer', label: 'Redactor', tool: 'Editor de documentos' },
    { id: 'n-qa-agent', label: 'Verificador', tool: 'Ejecutor de tests' },
  ];
  const specialists = rng.sample(pool, Math.min(pool.length, 1 + complexity + rng.int(0, 1)));
  const withReviewer = complexity >= 2 || rng.chance(0.5);
  b.group('g-core', 'Coordinación', { kind: 'cluster' })
    .group('g-tools', 'Herramientas', { kind: 'zone' })
    .group('g-memory', 'Memoria', { kind: 'zone' });
  const mid = (specialists.length - 1) / 2;
  b.node('n-user', 'client', 'Usuario', [-0.2, mid - 1.3]);
  b.node('n-vector', 'database', 'Memoria vectorial', [-0.2, mid + 0.4], { group: 'g-memory' });
  stack(
    b,
    [
      { id: 'n-coordinator', kind: 'agent', label: 'Coordinador' },
      { id: 'n-queue', kind: 'queue', label: 'Cola de subtareas' },
    ],
    1.4,
    mid,
    'g-core',
  );
  specialists.forEach((agent, index) =>
    b.node(agent.id, 'agent', `Agente ${agent.label.toLowerCase()}`, [2.85, index]),
  );
  specialists.forEach((agent, index) =>
    b.node(`${agent.id}-tool`, 'tool', agent.tool, [4.3, index], { group: 'g-tools' }),
  );
  b.node('n-llm', 'model', 'Modelo base', [2.85, specialists.length + 0.3]);
  if (withReviewer)
    b.node('n-reviewer', 'agent', 'Agente revisor', [1.4, mid + 1.6 + (specialists.length > 3 ? 0.6 : 0)]);
  b.edge('n-user', 'n-coordinator', 'request', 'Objetivo', { order: 1, fromSide: 'right', toSide: 'top' });
  b.edge('n-coordinator', 'n-vector', 'data', 'Contexto', {
    direction: 'bidirectional',
    fromSide: 'left',
    toSide: 'right',
  });
  b.edge('n-coordinator', 'n-queue', 'event', 'Subtareas', { order: 2 });
  specialists.forEach((agent, index) => {
    b.edge('n-queue', agent.id, 'event', index === 0 ? 'Asigna' : undefined, {
      order: 3,
      fromSide: 'right',
      toSide: 'left',
    });
    b.edge(agent.id, `${agent.id}-tool`, 'request', undefined, { order: 4 });
    if (index > 0 && rng.chance(0.5)) {
      const previous = specialists[index - 1];
      if (previous) b.edge(previous.id, agent.id, 'data', 'Comparte hallazgos', { fromSide: 'bottom', toSide: 'top' });
    }
  });
  const last = specialists[specialists.length - 1];
  if (last) b.edge(last.id, 'n-llm', 'dependency', 'Inferencia');
  if (withReviewer) {
    const first = specialists[0];
    if (first) {
      b.edge(first.id, 'n-reviewer', 'request', 'Entrega', { order: 5, fromSide: 'left', toSide: 'right' });
      b.edge('n-reviewer', first.id, 'control', 'Correcciones', { order: 6, fromSide: 'top', toSide: 'left' });
    }
    b.edge('n-reviewer', 'n-coordinator', 'response', 'Aprobado', { order: 7, fromSide: 'top', toSide: 'bottom' });
  }
}

function events(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const pool: Item[] = [
    { id: 'n-payments', kind: 'service', label: 'Pagos' },
    { id: 'n-inventory', kind: 'service', label: 'Inventario' },
    { id: 'n-shipping', kind: 'service', label: 'Envíos' },
    { id: 'n-notify', kind: 'function', label: 'Notificaciones' },
    { id: 'n-loyalty', kind: 'function', label: 'Fidelización' },
    { id: 'n-fraud', kind: 'model', label: 'Detección de fraude' },
  ];
  const consumers = rng.sample(pool, Math.min(pool.length, 2 + complexity));
  const outbox = complexity >= 2 || rng.chance(0.4);
  b.group('g-edge', 'Borde', { kind: 'zone' })
    .group('g-orders', 'Pedidos')
    .group('g-bus', 'Bus de eventos', { kind: 'cluster' })
    .group('g-consumers', 'Consumidores')
    .group('g-recovery', 'Recuperación', { kind: 'zone' });
  const mid = (consumers.length - 1) / 2;
  b.node('n-customer', 'client', 'Cliente', [0, mid]);
  b.node('n-gateway', 'gateway', 'API Gateway', [1.3, mid], { group: 'g-edge' });
  b.node('n-orders', 'service', 'Servicio de pedidos', [2.75, mid], { group: 'g-orders' });
  b.node('n-orders-db', 'database', 'Pedidos', [2.75, mid + 1.1], { group: 'g-orders' });
  if (outbox) b.node('n-outbox', 'function', 'Outbox relay', [2.75, mid - 1.1], { group: 'g-orders' });
  b.node('n-bus', 'queue', rng.pick(['Event bus', 'Broker de eventos', 'Log de eventos']), [4.2, mid], {
    group: 'g-bus',
  });
  stack(b, consumers, 5.65, mid, 'g-consumers');
  const recoveryRow = consumers.length + 0.4;
  b.node('n-dlq', 'queue', 'Dead-letter queue', [4.2, recoveryRow], { group: 'g-recovery' });
  b.node('n-retry', 'function', 'Reproceso', [3.2, recoveryRow], { group: 'g-recovery' });
  b.edge('n-customer', 'n-gateway', 'request', 'POST /orders', { order: 1 });
  b.edge('n-gateway', 'n-orders', 'request', 'Crear pedido', { order: 2 });
  b.edge('n-orders', 'n-orders-db', 'data', 'Persistir', { order: 3 });
  if (outbox) {
    b.edge('n-orders', 'n-outbox', 'data', 'Outbox', { order: 4 });
    b.edge('n-outbox', 'n-bus', 'event', 'OrderPlaced', { order: 5 });
  } else {
    b.edge('n-orders', 'n-bus', 'event', 'OrderPlaced', { order: 5 });
  }
  consumers.forEach((consumer, index) => {
    b.edge('n-bus', consumer.id, 'event', index === 0 ? 'Suscripción' : undefined, { order: 6 });
    if (consumer.kind === 'service' && rng.chance(0.6)) {
      b.edge(consumer.id, 'n-bus', 'event', `${consumer.label}OK`.replace(/\s/g, ''), {
        order: 7,
        fromSide: 'bottom',
        toSide: 'bottom',
      });
    }
  });
  b.edge('n-bus', 'n-dlq', 'async', 'Tras reintentos');
  b.edge('n-dlq', 'n-retry', 'event', 'Reproceso');
  b.edge('n-retry', 'n-bus', 'async', 'Reencola', { fromSide: 'top', toSide: 'left' });
}

function data(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const sourcePool: Item[] = [
    { id: 'n-appdb', kind: 'database', label: 'BD operacional' },
    { id: 'n-saas', kind: 'api', label: 'API SaaS' },
    { id: 'n-clicks', kind: 'frontend', label: 'Clickstream' },
    { id: 'n-files', kind: 'storage', label: 'Ficheros de socios' },
  ];
  const sources = rng.sample(sourcePool, Math.min(sourcePool.length, 1 + complexity));
  const streaming = complexity >= 2 || rng.chance(0.5);
  const layers = complexity === 1 ? ['Raw', 'Curated'] : ['Bronze', 'Silver', 'Gold'];
  b.group('g-sources', 'Fuentes', { kind: 'zone' })
    .group('g-ingest', 'Ingesta', { kind: 'lane' })
    .group('g-lake', 'Lakehouse', { kind: 'region' });
  b.group('g-layers', 'Capas', { kind: 'lane', parent: 'g-lake' }).group('g-serve', 'Consumo', { kind: 'zone' });
  const mid = (Math.max(sources.length, layers.length) - 1) / 2;
  stack(b, sources, 0, mid, 'g-sources');
  const ingestItems: Item[] = streaming
    ? [
        { id: 'n-stream', kind: 'queue', label: 'Streaming' },
        { id: 'n-processor', kind: 'service', label: 'Procesador' },
      ]
    : [{ id: 'n-loader', kind: 'function', label: 'Cargas batch' }];
  ingestItems.forEach((item, index) =>
    b.node(item.id, item.kind, item.label, [1.45 + index, mid], { group: 'g-ingest' }),
  );
  const lakeCol = 1.45 + ingestItems.length - 1 + STAGE_GAP + 0.15;
  const layerItems: Item[] = layers.map((layer) => ({
    id: `n-layer-${layer.toLowerCase()}`,
    kind: 'storage',
    label: layer,
  }));
  stack(b, layerItems, lakeCol, mid, 'g-layers');
  b.node(
    'n-transform',
    'function',
    rng.pick(['Transformaciones SQL', 'Jobs Spark', 'Modelos dbt']),
    [lakeCol + 1.1, mid],
    { group: 'g-lake' },
  );
  const serveCol = lakeCol + 1.1 + STAGE_GAP + 0.15;
  b.node('n-warehouse', 'database', 'Warehouse', [serveCol, mid - 0.55], { group: 'g-serve' });
  b.node('n-bi', 'frontend', 'BI', [serveCol, mid + 0.55], { group: 'g-serve' });
  const entry = ingestItems[0]?.id ?? 'n-loader';
  sources.forEach((source, index) =>
    b.edge(source.id, entry, streaming ? 'event' : 'data', index === 0 ? 'Captura' : undefined, { order: 1 }),
  );
  if (streaming) b.edge('n-stream', 'n-processor', 'event', 'Consumo', { order: 2 });
  const lastIngest = ingestItems[ingestItems.length - 1]?.id ?? entry;
  const firstLayer = layerItems[0]?.id ?? '';
  b.edge(lastIngest, firstLayer, 'data', 'Escritura', { order: 3 });
  layerItems.slice(1).forEach((layer, index) => {
    const previous = layerItems[index];
    if (previous) b.edge(previous.id, layer.id, 'data', undefined, { order: 4 + index });
  });
  const lastLayer = layerItems[layerItems.length - 1]?.id ?? firstLayer;
  b.edge(lastLayer, 'n-transform', 'data', 'Modela', { order: 4 + layerItems.length });
  b.edge('n-transform', 'n-warehouse', 'data', 'Publica', { order: 5 + layerItems.length });
  b.edge('n-bi', 'n-warehouse', 'request', 'SQL', { order: 6 + layerItems.length });
}

function iot(rng: Rng, complexity: Complexity, b: DiagramBuilder) {
  const sites = rng.sample(['Planta Norte', 'Planta Sur', 'Almacén', 'Flota', 'Parque solar'], 1 + complexity);
  const sensorLabels = ['Sensores de temperatura', 'Medidores', 'Cámaras', 'Vibración', 'GPS', 'PLC'];
  b.group('g-cloud', 'Región cloud', { kind: 'region' }).group('g-ingestion', 'Ingesta', {
    kind: 'cluster',
    parent: 'g-cloud',
  });
  let row = 0;
  const gateways: string[] = [];
  sites.forEach((site, siteIndex) => {
    const groupId = `g-site-${siteIndex + 1}`;
    b.group(groupId, site, { kind: 'zone' });
    const sensors = rng.int(1, 2);
    const items: Item[] = rng.sample(sensorLabels, sensors).map((label, index) => ({
      id: `n-s${siteIndex + 1}-${index + 1}`,
      kind: label === 'PLC' ? 'generic' : 'client',
      label,
    }));
    stack(b, items, 0, row + (sensors - 1) / 2, groupId);
    const gateway = `n-gw-${siteIndex + 1}`;
    b.node(gateway, 'gateway', `Gateway ${site.split(' ').pop() ?? site}`, [1.2, row + (sensors - 1) / 2], {
      group: groupId,
    });
    items.forEach((item) => b.edge(item.id, gateway, 'telemetry', undefined, { order: 1 }));
    gateways.push(gateway);
    row += sensors + 0.75;
  });
  const center = (row - 0.75) / 2 - 0.5;
  b.node('n-broker', 'queue', 'Broker MQTT', [3.2, center], { group: 'g-ingestion' });
  b.node('n-rules', 'function', 'Reglas', [4.3, center], { group: 'g-ingestion' });
  b.node('n-tsdb', 'database', 'Series temporales', [5.6, center - 0.6], { group: 'g-cloud' });
  b.node('n-archive', 'storage', 'Archivo', [5.6, center + 0.6], { group: 'g-cloud' });
  b.node('n-monitor', 'observability', 'Monitorización', [6.7, center - 0.6], { group: 'g-cloud' });
  const twin = complexity >= 2 && rng.chance(0.7);
  if (twin) b.node('n-twin', 'service', 'Gemelo digital', [6.7, center + 0.6], { group: 'g-cloud' });
  b.node('n-ota', 'service', 'Servicio OTA', [4.3, center + 1.5], { group: 'g-cloud' });
  gateways.forEach((gateway, index) => {
    b.edge(gateway, 'n-broker', 'telemetry', index === 0 ? 'MQTT/TLS' : undefined, { order: 2 });
    b.edge('n-ota', gateway, 'control', index === 0 ? 'OTA' : undefined, {
      order: 7,
      fromSide: 'left',
      toSide: 'bottom',
    });
  });
  b.edge('n-broker', 'n-rules', 'event', 'Telemetría', { order: 3 });
  b.edge('n-rules', 'n-tsdb', 'data', undefined, { order: 4 });
  b.edge('n-rules', 'n-archive', 'data', undefined, { order: 4 });
  b.edge('n-tsdb', 'n-monitor', 'data', 'Alertas', { order: 5 });
  if (twin) b.edge('n-tsdb', 'n-twin', 'data', 'Estado', { order: 6, fromSide: 'bottom', toSide: 'left' });
}

const RULES: Record<
  TemplateCategory,
  {
    name: string;
    style: StyleId;
    /** Appearance options that go with the recommended style. */
    appearance?: Partial<AppearanceSettings>;
    build: (rng: Rng, complexity: Complexity, b: DiagramBuilder) => void;
  }
> = {
  'load-testing': { name: 'Pruebas de carga', style: 'porcelain', build: loadTesting },
  rag: { name: 'RAG', style: 'midnight', appearance: { translucentLayers: true }, build: rag },
  'multi-agent': { name: 'Multiagente', style: 'midnight', build: multiAgent },
  events: { name: 'Eventos', style: 'editorial', build: events },
  data: { name: 'Plataforma de datos', style: 'blueprint', build: data },
  iot: { name: 'Edge / IoT', style: 'porcelain', appearance: { connectorRoute: 'arc' }, build: iot },
};

export function generateVariation(request: VariationRequest) {
  const rule = RULES[request.category];
  const rng = createRng(request.seed);
  const builder = new DiagramBuilder({
    id: `var-${request.category}-${request.seed}-${request.complexity}`,
    name: `${rule.name} · variación ${request.seed}`,
    description: `Generado localmente por reglas (categoría ${rule.name}, seed ${request.seed}, complejidad ${request.complexity}). Ilustrativo; no es una arquitectura desplegada.`,
    styleId: request.styleId ?? rule.style,
    ...(request.styleId ? {} : { appearance: rule.appearance }),
  });
  rule.build(rng, request.complexity, builder);
  return builder.build();
}
