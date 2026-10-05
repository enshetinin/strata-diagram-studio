import type { GroupKind, NodeKind, RelationKind } from './types';

export interface KindInfo {
  label: string;
  /** Short textual glyph shown on 2D nodes and 3D plates (never a vendor logo). */
  code: string;
  summary: string;
  /** Visual body height in 3D world units. */
  height: number;
}

export const KIND_INFO: Record<NodeKind, KindInfo> = {
  client: { label: 'Cliente', code: 'USR', summary: 'Persona, dispositivo o sistema que inicia la interacción', height: 0.55 },
  frontend: { label: 'Frontend', code: 'UI', summary: 'Interfaz web o móvil', height: 0.42 },
  api: { label: 'API', code: 'API', summary: 'Contrato de entrada síncrono', height: 0.5 },
  service: { label: 'Servicio', code: 'SVC', summary: 'Proceso de negocio de larga vida', height: 0.6 },
  function: { label: 'Función', code: 'FN', summary: 'Cómputo efímero disparado por eventos', height: 0.45 },
  database: { label: 'Base de datos', code: 'DB', summary: 'Almacenamiento estructurado consultable', height: 0.62 },
  storage: { label: 'Almacenamiento', code: 'OBJ', summary: 'Objetos, archivos o blobs', height: 0.3 },
  queue: { label: 'Cola / bus', code: 'Q', summary: 'Mensajería asíncrona y desacoplamiento', height: 0.32 },
  cache: { label: 'Caché', code: 'KV', summary: 'Lecturas rápidas en memoria', height: 0.26 },
  agent: { label: 'Agente', code: 'AGT', summary: 'Proceso autónomo que planifica y usa herramientas', height: 0.7 },
  model: { label: 'Modelo', code: 'ML', summary: 'Modelo de lenguaje, embeddings o predicción', height: 0.66 },
  tool: { label: 'Herramienta', code: 'TL', summary: 'Capacidad invocable por agentes', height: 0.6 },
  gateway: { label: 'Gateway', code: 'GW', summary: 'Punto de entrada, enrutamiento o borde de red', height: 0.68 },
  observability: { label: 'Observabilidad', code: 'OBS', summary: 'Métricas, trazas y logs', height: 0.58 },
  generic: { label: 'Genérico', code: '•', summary: 'Componente sin categoría específica', height: 0.48 },
};

export const RELATION_INFO: Record<RelationKind, { label: string; dashed: boolean }> = {
  request: { label: 'Petición', dashed: false },
  response: { label: 'Respuesta', dashed: false },
  data: { label: 'Datos', dashed: false },
  event: { label: 'Evento', dashed: true },
  async: { label: 'Asíncrona', dashed: true },
  dependency: { label: 'Dependencia', dashed: true },
  telemetry: { label: 'Telemetría', dashed: true },
  control: { label: 'Control', dashed: false },
};

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  domain: 'Dominio',
  region: 'Región',
  network: 'Red',
  cluster: 'Clúster',
  lane: 'Carril',
  zone: 'Zona',
};
