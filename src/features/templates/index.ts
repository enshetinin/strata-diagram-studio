import type { DiagramDocument, StyleId } from '../../domain/types';
import { DiagramBuilder } from './builder';
import { awsLoadTesting } from './catalog/awsLoadTesting';
import { dataPlatform } from './catalog/dataPlatform';
import { edgeIot } from './catalog/edgeIot';
import { eventCommerce } from './catalog/eventCommerce';
import { multiAgent } from './catalog/multiAgent';
import { ragDocumental } from './catalog/ragDocumental';

export const TEMPLATE_CATEGORIES = ['load-testing', 'rag', 'multi-agent', 'events', 'data', 'iot'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateInfo {
  id: string;
  category: TemplateCategory;
  name: string;
  summary: string;
  composition: string;
  recommendedStyle: StyleId;
  create: () => DiagramDocument;
}

export const TEMPLATES: readonly TemplateInfo[] = [
  {
    id: 'aws-load-testing',
    category: 'load-testing',
    name: 'AWS Load Testing',
    summary: 'Frontend/API, orquestación, workers en VPC, métricas y resultados',
    composition: 'Tres plataformas de dominio y recorrido numerado',
    recommendedStyle: 'porcelain',
    create: awsLoadTesting,
  },
  {
    id: 'rag',
    category: 'rag',
    name: 'RAG documental',
    summary: 'Ingesta → parsing → embeddings → índice; consulta → retrieval → modelo',
    composition: 'Dos carriles: ingestión y consulta',
    recommendedStyle: 'glass',
    create: ragDocumental,
  },
  {
    id: 'multi-agent',
    category: 'multi-agent',
    name: 'Sistema multiagente',
    summary: 'Coordinador, agentes especializados, herramientas y memoria compartida',
    composition: 'Centro con satélites y conexiones laterales',
    recommendedStyle: 'midnight',
    create: multiAgent,
  },
  {
    id: 'event-commerce',
    category: 'events',
    name: 'Comercio por eventos',
    summary: 'Gateway, pedidos, pagos, inventario, bus, consumidores y DLQ',
    composition: 'Flujo principal con ramas y retornos',
    recommendedStyle: 'monochrome',
    create: eventCommerce,
  },
  {
    id: 'data-platform',
    category: 'data',
    name: 'Plataforma de datos',
    summary: 'Fuentes, streaming, procesamiento, lakehouse, warehouse y BI',
    composition: 'Etapas con bandas de profundidad',
    recommendedStyle: 'blueprint',
    create: dataPlatform,
  },
  {
    id: 'edge-iot',
    category: 'iot',
    name: 'Edge / IoT',
    summary: 'Dispositivos, gateways, región cloud, almacenamiento y monitorización',
    composition: 'Clusters separados y convergencia regional',
    recommendedStyle: 'orbit',
    create: edgeIot,
  },
];

export function findTemplate(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((template) => template.id === id || template.category === id);
}

/** An empty diagram to start from scratch; a fresh id so it never matches a template. */
export function blankDocument(): DiagramDocument {
  return new DiagramBuilder({ id: `doc-${Date.now().toString(36)}`, name: 'Diagrama sin título', description: '', styleId: 'porcelain' }).build();
}

export function defaultDocument(): DiagramDocument {
  return awsLoadTesting();
}
