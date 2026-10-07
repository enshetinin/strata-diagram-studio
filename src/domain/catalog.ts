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
  client: {
    label: 'Cliente',
    code: 'USR',
    summary: 'Persona, dispositivo o sistema que inicia la interacción',
    height: 0.55,
  },
  human: { label: 'Revisión humana', code: 'HIL', summary: 'Persona en el bucle que revisa o aprueba', height: 0.55 },
  device: { label: 'Dispositivo', code: 'DEV', summary: 'Sensor, actuador o hardware conectado', height: 0.44 },
  frontend: { label: 'Frontend', code: 'UI', summary: 'Interfaz web o móvil', height: 0.42 },
  mobile: { label: 'Móvil', code: 'MOB', summary: 'App en teléfono o tableta', height: 0.52 },
  api: { label: 'API', code: 'API', summary: 'Contrato de entrada síncrono', height: 0.5 },
  service: { label: 'Servicio', code: 'SVC', summary: 'Proceso de negocio de larga vida', height: 0.6 },
  container: { label: 'Contenedor', code: 'CTR', summary: 'Proceso empaquetado con su entorno', height: 0.48 },
  vm: { label: 'Máquina virtual', code: 'VM', summary: 'Servidor o instancia con sistema operativo', height: 0.58 },
  function: { label: 'Función', code: 'FN', summary: 'Cómputo efímero disparado por eventos', height: 0.45 },
  scheduler: { label: 'Tareas programadas', code: 'CRON', summary: 'Dispara trabajos a horas fijas', height: 0.56 },
  workflow: { label: 'Workflow', code: 'WF', summary: 'Pasos orquestados con estado y reintentos', height: 0.56 },
  database: { label: 'Base de datos', code: 'DB', summary: 'Almacenamiento estructurado consultable', height: 0.62 },
  vector: { label: 'Base vectorial', code: 'VEC', summary: 'Embeddings consultables por similitud', height: 0.6 },
  search: { label: 'Búsqueda', code: 'IDX', summary: 'Índice de texto completo', height: 0.58 },
  warehouse: {
    label: 'Data warehouse',
    code: 'DWH',
    summary: 'Analítica sobre grandes volúmenes de datos',
    height: 0.56,
  },
  storage: { label: 'Almacenamiento', code: 'OBJ', summary: 'Objetos, archivos o blobs', height: 0.3 },
  document: { label: 'Documento', code: 'DOC', summary: 'Fichero, corpus o contenido de referencia', height: 0.58 },
  registry: { label: 'Registro', code: 'REG', summary: 'Imágenes y artefactos versionados', height: 0.56 },
  repo: { label: 'Repositorio', code: 'GIT', summary: 'Código fuente versionado', height: 0.44 },
  queue: { label: 'Cola / bus', code: 'Q', summary: 'Mensajería asíncrona y desacoplamiento', height: 0.32 },
  stream: { label: 'Stream', code: 'STR', summary: 'Log de eventos ordenado y particionado', height: 0.34 },
  notification: { label: 'Notificación', code: 'MSG', summary: 'Email, SMS o push hacia personas', height: 0.48 },
  cache: { label: 'Caché', code: 'KV', summary: 'Lecturas rápidas en memoria', height: 0.26 },
  agent: { label: 'Agente', code: 'AGT', summary: 'Proceso autónomo que planifica y usa herramientas', height: 0.7 },
  model: { label: 'Modelo', code: 'ML', summary: 'Modelo de lenguaje, embeddings o predicción', height: 0.66 },
  guardrail: { label: 'Guardrail', code: 'GRD', summary: 'Valida entradas y salidas de modelos', height: 0.5 },
  tool: { label: 'Herramienta', code: 'TL', summary: 'Capacidad invocable por agentes', height: 0.6 },
  notebook: { label: 'Notebook', code: 'NB', summary: 'Exploración interactiva de datos', height: 0.46 },
  gateway: { label: 'Gateway', code: 'GW', summary: 'Punto de entrada, enrutamiento o borde de red', height: 0.68 },
  balancer: { label: 'Balanceador', code: 'LB', summary: 'Reparte tráfico entre réplicas', height: 0.46 },
  cdn: { label: 'CDN', code: 'CDN', summary: 'Contenido en caché cerca del usuario', height: 0.42 },
  dns: { label: 'DNS', code: 'DNS', summary: 'Resolución de nombres', height: 0.66 },
  firewall: { label: 'Firewall', code: 'FW', summary: 'Filtra tráfico de red o de aplicación', height: 0.5 },
  identity: { label: 'Identidad', code: 'IAM', summary: 'Autenticación, usuarios y permisos', height: 0.6 },
  secret: { label: 'Secretos', code: 'KEY', summary: 'Claves, credenciales y cifrado', height: 0.5 },
  observability: { label: 'Observabilidad', code: 'OBS', summary: 'Métricas, trazas y logs', height: 0.58 },
  external: { label: 'Externo', code: 'EXT', summary: 'Sistema de terceros fuera de tu control', height: 0.5 },
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
  auth: { label: 'Autenticación', dashed: true },
  stream: { label: 'Stream', dashed: false },
  replication: { label: 'Replicación', dashed: true },
  sync: { label: 'Sincronización', dashed: true },
  backup: { label: 'Copia de seguridad', dashed: true },
  deploy: { label: 'Despliegue', dashed: true },
};

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  domain: 'Dominio',
  region: 'Región',
  network: 'Red',
  cluster: 'Clúster',
  lane: 'Carril',
  zone: 'Zona',
  account: 'Cuenta',
  environment: 'Entorno',
  'availability-zone': 'Zona de disponibilidad',
  subnet: 'Subred',
  namespace: 'Namespace',
  boundary: 'Límite de confianza',
};
