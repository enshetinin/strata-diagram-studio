import { DiagramBuilder } from '../builder';

/** Two lanes: ingestion on top, query below, joined by the shared embedding model and the index. */
export function ragDocumental() {
  return new DiagramBuilder({
    id: 'tpl-rag',
    name: 'RAG documental',
    description:
      'Ingesta → parsing → embeddings → índice vectorial; consulta → retrieval → re-ranking → modelo → respuesta con citas. Ejemplo ilustrativo.',
    styleId: 'midnight',
    appearance: { translucentLayers: true },
  })
    .group('g-ingest', 'Ingesta', { kind: 'lane', description: 'Proceso por lotes al llegar documentos' })
    .group('g-query', 'Consulta', { kind: 'lane', description: 'Ruta síncrona por pregunta' })
    .node('n-sources', 'storage', 'Documentos fuente', [0.8, 0], { group: 'g-ingest' })
    .node('n-loader', 'service', 'Loader', [1.8, 0], { group: 'g-ingest' })
    .node('n-parser', 'function', 'Parsing y chunking', [2.8, 0], { group: 'g-ingest' })
    .node('n-embed-job', 'function', 'Generador de embeddings', [3.8, 0], { group: 'g-ingest' })
    .node('n-index', 'database', 'Índice vectorial', [4.8, 0], { group: 'g-ingest' })
    .node('n-embedder', 'model', 'Modelo de embeddings', [3.3, 1.2], { description: 'Compartido por ambos carriles' })
    .node('n-user', 'client', 'Usuario', [-0.5, 2.4])
    .node('n-chat', 'frontend', 'Chat', [0.8, 2.4], { group: 'g-query' })
    .node('n-api', 'api', 'API de consulta', [1.8, 2.4], { group: 'g-query' })
    .node('n-retriever', 'service', 'Retriever', [2.8, 2.4], { group: 'g-query' })
    .node('n-reranker', 'model', 'Re-ranker', [3.8, 2.4], { group: 'g-query' })
    .node('n-llm', 'model', 'LLM generador', [4.8, 2.4], { group: 'g-query' })
    .node('n-cache', 'cache', 'Caché semántica', [1.8, 3.6], { group: 'g-query' })
    .node('n-evals', 'observability', 'Trazas y evaluación', [4.8, 3.6], { group: 'g-query' })
    .edge('n-sources', 'n-loader', 'data', 'Nuevos documentos', {
      order: 1,
      explanation: 'Los documentos nuevos o modificados entran por lotes.',
    })
    .edge('n-loader', 'n-parser', 'data', 'Texto', { order: 2 })
    .edge('n-parser', 'n-embed-job', 'data', 'Fragmentos', {
      order: 3,
      explanation: 'Fragmentos con metadatos de origen para poder citar.',
    })
    .edge('n-embed-job', 'n-embedder', 'request', 'Vectoriza', { order: 4 })
    .edge('n-embed-job', 'n-index', 'data', 'Upsert', { order: 5 })
    .edge('n-user', 'n-chat', 'request', 'Pregunta', { order: 6 })
    .edge('n-chat', 'n-api', 'request', 'POST /ask', { order: 7 })
    .edge('n-api', 'n-cache', 'request', 'Consulta caché', { order: 8, direction: 'bidirectional' })
    .edge('n-api', 'n-retriever', 'request', 'Recupera', { order: 9 })
    .edge('n-retriever', 'n-embedder', 'request', 'Embedding de la consulta', { order: 10 })
    .edge('n-retriever', 'n-index', 'request', 'Top-k', {
      order: 11,
      explanation: 'Búsqueda por similitud en el índice construido por la ingesta.',
    })
    .edge('n-retriever', 'n-reranker', 'data', 'Candidatos', { order: 12 })
    .edge('n-reranker', 'n-llm', 'data', 'Contexto', { order: 13 })
    .edge('n-llm', 'n-api', 'response', 'Respuesta con citas', { order: 14, fromSide: 'bottom', toSide: 'bottom' })
    .edge('n-api', 'n-chat', 'response', 'Respuesta', { order: 15, fromSide: 'top', toSide: 'top' })
    .edge('n-llm', 'n-evals', 'telemetry', 'Trazas')
    .build();
}
