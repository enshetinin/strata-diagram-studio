import { TEMPLATES, type TemplateInfo } from '../templates';

/**
 * Keyword matching used only to point at compatible examples when no remote
 * provider is configured. It is labelled as such in the UI; it is not
 * language understanding.
 */
const KEYWORDS: Record<TemplateInfo['category'], string[]> = {
  'load-testing': ['carga', 'load', 'estrés', 'stress', 'k6', 'jmeter', 'locust', 'rendimiento', 'performance', 'fargate', 'ecs'],
  rag: ['rag', 'retrieval', 'embedding', 'vector', 'documentos', 'búsqueda semántica', 'chatbot', 'llm', 'citas', 'índice'],
  'multi-agent': ['agente', 'agentes', 'agent', 'multiagente', 'coordinador', 'herramientas', 'tools', 'planner', 'memoria'],
  events: ['evento', 'eventos', 'event', 'kafka', 'bus', 'pedido', 'pedidos', 'pago', 'inventario', 'dlq', 'cola', 'e-commerce', 'comercio'],
  data: ['datos', 'data', 'lakehouse', 'warehouse', 'etl', 'elt', 'bi', 'streaming', 'spark', 'dbt', 'medallion', 'analítica'],
  iot: ['iot', 'edge', 'sensor', 'sensores', 'dispositivo', 'dispositivos', 'mqtt', 'gateway', 'planta', 'flota', 'telemetría'],
};

export function suggestTemplates(prompt: string): TemplateInfo[] {
  const text = prompt.toLowerCase();
  return TEMPLATES.map((template) => ({ template, score: KEYWORDS[template.category].filter((word) => text.includes(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.template);
}
