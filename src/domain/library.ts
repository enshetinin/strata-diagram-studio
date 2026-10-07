/**
 * Component library: named presets over the closed set of node kinds.
 *
 * A kind is an archetype with its own glyph and 3D model; a preset only
 * pre-fills a new node (kind, label, provider). Documents store the resulting
 * node, never the preset id, so presets can grow freely without touching the
 * schema or the renderers.
 */
import { KIND_INFO } from './catalog';
import type { AddNodeInput } from './commands';
import { NODE_KINDS, type NodeKind } from './types';

export type NodeSeed = Pick<AddNodeInput, 'kind' | 'label' | 'provider' | 'description'>;

export const LIBRARY_CATEGORIES = [
  { id: 'essentials', label: 'Esenciales' },
  { id: 'actors', label: 'Actores e interfaces' },
  { id: 'compute', label: 'Cómputo' },
  { id: 'data', label: 'Datos' },
  { id: 'messaging', label: 'Mensajería y eventos' },
  { id: 'network', label: 'Red y borde' },
  { id: 'security', label: 'Seguridad e identidad' },
  { id: 'ai', label: 'IA y modelos' },
  { id: 'agents', label: 'Agentes' },
  { id: 'analytics', label: 'Analítica' },
  { id: 'observability', label: 'Observabilidad' },
  { id: 'platform', label: 'Plataforma y DevOps' },
  { id: 'iot', label: 'IoT y edge' },
  { id: 'external', label: 'Servicios externos' },
] as const;
export type LibraryCategoryId = (typeof LIBRARY_CATEGORIES)[number]['id'];

export interface LibraryPreset {
  id: string;
  category: LibraryCategoryId;
  kind: NodeKind;
  /** Library title and initial node label. Unique across the library. */
  label: string;
  summary: string;
  /** Free text, as on nodes. Never implies an official logo. */
  provider?: string;
  /** Extra search terms (synonyms, English names, products). */
  tags: readonly string[];
}

const GENERIC_ICON_NOTE = 'Icono genérico; no es un logo oficial';

type PresetRow = [id: string, kind: NodeKind, label: string, summary: string, tags: string, provider?: string];

function rows(category: LibraryCategoryId, list: PresetRow[]): LibraryPreset[] {
  return list.map(([id, kind, label, summary, tags, provider]) => ({
    id,
    category,
    kind,
    label,
    summary,
    tags: tags.split(' ').filter(Boolean),
    ...(provider ? { provider } : {}),
  }));
}

/** One preset per kind, so every archetype stays one click away. */
const ESSENTIALS: LibraryPreset[] = NODE_KINDS.map((kind) => ({ id: kind, category: 'essentials', kind, label: KIND_INFO[kind].label, summary: KIND_INFO[kind].summary, tags: [kind] }));

export const LIBRARY_PRESETS: readonly LibraryPreset[] = [
  ...ESSENTIALS,
  ...rows('actors', [
    ['end-user', 'client', 'Usuario final', 'Persona que usa el producto', 'user cliente persona'],
    ['admin', 'client', 'Administrador', 'Operación interna con permisos elevados', 'admin backoffice operador'],
    ['partner', 'client', 'Partner B2B', 'Sistema o empresa externa que integra', 'b2b partner integración'],
    ['legacy', 'generic', 'Sistema legado', 'Sistema existente que no se modifica', 'legacy mainframe heredado'],
    ['web-app', 'frontend', 'Aplicación web', 'SPA o web renderizada en servidor', 'spa react next web'],
    ['mobile-app', 'mobile', 'App móvil', 'Aplicación iOS o Android', 'mobile ios android móvil'],
    ['desktop-app', 'frontend', 'App de escritorio', 'Cliente nativo o Electron', 'desktop electron escritorio'],
    ['backoffice', 'frontend', 'Backoffice', 'Panel interno de gestión', 'admin panel interno'],
    ['cli', 'client', 'CLI', 'Herramienta de línea de comandos', 'terminal consola cli'],
  ]),
  ...rows('compute', [
    ['microservice', 'service', 'Microservicio', 'Servicio desplegable de forma independiente', 'microservice servicio'],
    ['worker', 'service', 'Worker', 'Consume trabajo en segundo plano', 'background consumidor job'],
    ['batch-job', 'function', 'Job por lotes', 'Proceso programado de duración acotada', 'batch cron lote'],
    ['grpc-service', 'api', 'Servicio gRPC', 'Contrato binario entre servicios', 'grpc protobuf rpc'],
    ['graphql', 'api', 'API GraphQL', 'Esquema consultable por el cliente', 'graphql apollo schema'],
    ['rest-api', 'api', 'API REST', 'Recursos HTTP con verbos estándar', 'rest http openapi'],
    ['bff', 'api', 'BFF', 'Backend específico para un frontend', 'backend for frontend bff'],
    ['websocket', 'service', 'Servidor WebSocket', 'Conexiones bidireccionales persistentes', 'websocket realtime tiempo real'],
    ['aws-lambda', 'function', 'Lambda', 'Función gestionada por eventos', 'serverless faas', 'AWS'],
    ['cloud-function', 'function', 'Cloud Function', 'Función gestionada por eventos', 'serverless faas gcp', 'Google Cloud'],
    ['edge-function', 'function', 'Edge function', 'Cómputo ligero cerca del usuario', 'edge worker cdn'],
    ['docker', 'container', 'Docker', 'Contenedor OCI con su entorno', 'docker container oci contenedor'],
    ['k8s-pod', 'container', 'Pod', 'Unidad de despliegue en Kubernetes', 'kubernetes k8s pod'],
    ['fargate', 'container', 'Tarea Fargate', 'Contenedor sin gestionar servidores', 'ecs container', 'AWS'],
    ['ec2', 'vm', 'EC2', 'Instancia de cómputo gestionada', 'vm compute instancia servidor', 'AWS'],
    ['step-functions', 'workflow', 'Step Functions', 'Máquina de estados gestionada', 'workflow orquestación estado', 'AWS'],
    ['temporal', 'workflow', 'Temporal', 'Workflows duraderos como código', 'workflow durable saga'],
  ]),
  ...rows('data', [
    ['postgres', 'database', 'PostgreSQL', 'Base relacional de propósito general', 'sql relacional postgres'],
    ['mysql', 'database', 'MySQL', 'Base relacional', 'sql relacional mariadb'],
    ['mongodb', 'database', 'MongoDB', 'Base documental', 'nosql documentos json'],
    ['dynamodb', 'database', 'DynamoDB', 'Clave-valor gestionada', 'nosql clave valor', 'AWS'],
    ['cassandra', 'database', 'Cassandra', 'Columnar distribuida de escritura masiva', 'nosql wide column'],
    ['timeseries-db', 'database', 'Serie temporal', 'Métricas y lecturas indexadas por tiempo', 'timeseries influx timescale'],
    ['graph-db', 'database', 'Base de grafos', 'Relaciones como ciudadanos de primera', 'graph neo4j grafo'],
    ['pgvector', 'vector', 'pgvector', 'Búsqueda vectorial dentro de PostgreSQL', 'vector embeddings postgres rag'],
    ['search-index', 'search', 'Índice de búsqueda', 'Búsqueda de texto completo', 'search elasticsearch opensearch full text'],
    ['redis', 'cache', 'Redis', 'Estructuras en memoria y caché', 'cache memoria kv'],
    ['memcached', 'cache', 'Memcached', 'Caché distribuida simple', 'cache memoria'],
    ['session-store', 'cache', 'Almacén de sesiones', 'Sesiones de usuario en memoria', 'session sesión'],
    ['s3', 'storage', 'S3', 'Almacenamiento de objetos', 'bucket objetos blob', 'AWS'],
    ['gcs', 'storage', 'Cloud Storage', 'Almacenamiento de objetos', 'bucket objetos blob', 'Google Cloud'],
    ['blob', 'storage', 'Blob Storage', 'Almacenamiento de objetos', 'bucket objetos', 'Azure'],
    ['file-share', 'storage', 'Sistema de ficheros', 'Volumen compartido o NFS', 'nfs efs volumen ficheros'],
    ['backup', 'storage', 'Copias de seguridad', 'Snapshots y retención', 'backup snapshot recuperación'],
    ['qdrant', 'vector', 'Qdrant', 'Base vectorial autoalojable', 'vector embeddings similitud'],
    ['snowflake', 'warehouse', 'Snowflake', 'Data warehouse en la nube', 'dwh analítica sql'],
    ['bigquery', 'warehouse', 'BigQuery', 'Data warehouse sin servidor', 'dwh analítica sql', 'Google Cloud'],
    ['redshift', 'warehouse', 'Redshift', 'Data warehouse columnar', 'dwh analítica sql', 'AWS'],
    ['dataset', 'document', 'Dataset', 'Fichero de datos versionado', 'csv parquet dataset fichero'],
  ]),
  ...rows('messaging', [
    ['kafka-topic', 'stream', 'Topic de Kafka', 'Log de eventos particionado', 'kafka stream streaming log'],
    ['kinesis', 'stream', 'Kinesis', 'Streaming de datos gestionado', 'stream streaming tiempo real', 'AWS'],
    ['redpanda', 'stream', 'Redpanda', 'Streaming compatible con Kafka', 'kafka stream streaming'],
    ['sqs', 'queue', 'SQS', 'Cola gestionada', 'cola queue', 'AWS'],
    ['sns', 'queue', 'SNS', 'Publicación a múltiples suscriptores', 'pubsub fanout notificación', 'AWS'],
    ['eventbridge', 'queue', 'EventBridge', 'Bus de eventos con reglas', 'bus eventos reglas', 'AWS'],
    ['pubsub', 'queue', 'Pub/Sub', 'Mensajería publicación-suscripción', 'pubsub mensajería', 'Google Cloud'],
    ['rabbitmq', 'queue', 'RabbitMQ', 'Broker con exchanges y colas', 'amqp broker cola'],
    ['nats', 'queue', 'NATS', 'Mensajería ligera de baja latencia', 'nats jetstream broker'],
    ['dlq', 'queue', 'Cola de errores (DLQ)', 'Mensajes que agotaron reintentos', 'dlq dead letter reintentos'],
    ['outbox', 'database', 'Outbox', 'Tabla de eventos pendientes de publicar', 'outbox transaccional patrón'],
    ['cdc', 'function', 'CDC', 'Captura de cambios de la base de datos', 'cdc debezium change data capture'],
    ['webhook', 'api', 'Webhook', 'Callback HTTP hacia o desde terceros', 'webhook callback http'],
  ]),
  ...rows('network', [
    ['api-gateway', 'gateway', 'API Gateway', 'Entrada gestionada a las APIs', 'gateway entrada', 'AWS'],
    ['load-balancer', 'balancer', 'Balanceador de carga', 'Reparte tráfico entre instancias', 'lb alb nlb load balancer'],
    ['reverse-proxy', 'balancer', 'Proxy inverso', 'Termina TLS y enruta peticiones', 'nginx envoy proxy'],
    ['elb', 'balancer', 'Elastic Load Balancing', 'Balanceador gestionado', 'alb nlb lb', 'AWS'],
    ['ingress', 'gateway', 'Ingress', 'Entrada HTTP al clúster', 'kubernetes ingress k8s'],
    ['cloudfront', 'cdn', 'CloudFront', 'CDN gestionada', 'cdn edge caché', 'AWS'],
    ['cloudflare', 'cdn', 'Cloudflare', 'CDN, DNS y protección en el borde', 'cdn waf ddos edge'],
    ['route53', 'dns', 'Route 53', 'DNS gestionado', 'dns dominio', 'AWS'],
    ['service-mesh', 'gateway', 'Service mesh', 'Tráfico este-oeste entre servicios', 'mesh istio linkerd sidecar'],
    ['nat', 'gateway', 'NAT', 'Salida a internet desde red privada', 'nat egress salida'],
    ['vpn', 'gateway', 'VPN', 'Túnel cifrado entre redes', 'vpn túnel conexión'],
    ['rate-limiter', 'service', 'Limitador de tasa', 'Protege servicios de picos de tráfico', 'rate limit throttling cuota'],
  ]),
  ...rows('security', [
    ['idp', 'identity', 'Proveedor de identidad', 'Autenticación OAuth / OIDC', 'auth oauth oidc sso login identidad'],
    ['cognito', 'identity', 'Cognito', 'Usuarios y autenticación gestionados', 'auth login identidad', 'AWS'],
    ['keycloak', 'identity', 'Keycloak', 'Identidad y SSO autoalojados', 'auth sso oidc identidad'],
    ['auth0', 'identity', 'Auth0', 'Identidad como servicio', 'auth login sso oidc'],
    ['entra-id', 'identity', 'Entra ID', 'Identidad corporativa y SSO', 'azure active directory sso', 'Microsoft'],
    ['waf', 'firewall', 'WAF', 'Filtra tráfico malicioso', 'firewall waf seguridad'],
    ['security-group', 'firewall', 'Security group', 'Reglas de red por instancia', 'firewall red reglas sg', 'AWS'],
    ['secrets', 'secret', 'Gestor de secretos', 'Credenciales y claves fuera del código', 'vault secrets credenciales'],
    ['kms', 'secret', 'KMS', 'Gestión de claves de cifrado', 'kms cifrado claves encryption'],
    ['vault', 'secret', 'Vault', 'Secretos dinámicos y cifrado', 'hashicorp secrets credenciales'],
    ['secrets-manager', 'secret', 'Secrets Manager', 'Secretos con rotación gestionada', 'secrets credenciales rotación', 'AWS'],
    ['certificates', 'secret', 'Certificados TLS', 'Emisión y renovación de certificados', 'tls ssl acm certificados'],
    ['policy-engine', 'identity', 'Motor de políticas', 'Autorización declarativa', 'opa policy autorización rbac'],
    ['audit-log', 'storage', 'Registro de auditoría', 'Traza inmutable de acciones', 'audit auditoría cumplimiento'],
  ]),
  ...rows('ai', [
    ['llm', 'model', 'LLM', 'Modelo de lenguaje para generar o razonar', 'llm gpt claude chat lenguaje'],
    ['embeddings', 'model', 'Modelo de embeddings', 'Convierte texto en vectores', 'embeddings vector rag'],
    ['reranker', 'model', 'Reranker', 'Reordena resultados por relevancia', 'rerank relevancia rag'],
    ['classifier', 'model', 'Clasificador', 'Asigna categorías o puntuaciones', 'classifier ml predicción'],
    ['ocr', 'model', 'OCR', 'Extrae texto de imágenes y PDF', 'ocr documentos pdf visión'],
    ['speech-to-text', 'model', 'Voz a texto', 'Transcripción de audio', 'stt asr transcripción audio'],
    ['text-to-speech', 'model', 'Texto a voz', 'Síntesis de voz', 'tts voz audio'],
    ['inference-endpoint', 'api', 'Endpoint de inferencia', 'Modelo servido detrás de una API', 'inference serving endpoint'],
    ['prompt-template', 'document', 'Plantilla de prompt', 'Instrucciones versionadas para el modelo', 'prompt plantilla instrucciones'],
    ['corpus', 'document', 'Corpus documental', 'Documentos fuente para recuperar', 'rag documentos pdf corpus'],
    ['content-filter', 'guardrail', 'Filtro de contenido', 'Moderación de entradas y salidas', 'guardrail moderación seguridad filtro'],
    ['evaluator', 'service', 'Evaluador', 'Mide calidad de respuestas', 'eval evaluación llm judge'],
    ['fine-tuning', 'function', 'Fine-tuning', 'Entrena un modelo sobre datos propios', 'fine tuning entrenamiento training'],
    ['model-registry', 'registry', 'Registro de modelos', 'Versiones y artefactos de modelos', 'registry mlflow versiones'],
  ]),
  ...rows('agents', [
    ['planner', 'agent', 'Planificador', 'Descompone el objetivo en pasos', 'planner plan agente'],
    ['supervisor', 'agent', 'Supervisor', 'Enruta tareas entre agentes', 'router supervisor coordinador'],
    ['executor', 'agent', 'Ejecutor', 'Realiza pasos con herramientas', 'executor ejecutor worker'],
    ['critic', 'agent', 'Crítico', 'Revisa y corrige el resultado', 'critic revisor reflexión'],
    ['agent-memory', 'vector', 'Memoria del agente', 'Contexto persistente entre sesiones', 'memory memoria contexto'],
    ['web-search-tool', 'tool', 'Búsqueda web', 'Herramienta de búsqueda en internet', 'search web navegador'],
    ['code-exec-tool', 'tool', 'Ejecución de código', 'Sandbox para ejecutar código', 'code sandbox intérprete python'],
    ['sql-tool', 'tool', 'Consulta SQL', 'Herramienta que consulta datos', 'sql consulta datos'],
    ['mcp-server', 'tool', 'Servidor MCP', 'Expone herramientas por Model Context Protocol', 'mcp model context protocol'],
    ['human-approval', 'human', 'Aprobación humana', 'Persona que valida antes de actuar', 'human in the loop hitl revisor'],
  ]),
  ...rows('analytics', [
    ['ingestion', 'function', 'Ingesta', 'Carga datos desde las fuentes', 'ingest ingestión extract'],
    ['etl', 'function', 'ETL / ELT', 'Transforma y carga datos', 'etl elt transformación'],
    ['spark-job', 'function', 'Job de Spark', 'Procesamiento distribuido', 'spark databricks distribuido'],
    ['dbt', 'function', 'Modelo dbt', 'Transformaciones SQL versionadas', 'dbt sql transformación'],
    ['orchestrator', 'workflow', 'Orquestador de datos', 'Programa y encadena pipelines', 'airflow dagster orquestación dag'],
    ['lakehouse', 'warehouse', 'Lakehouse', 'Tablas abiertas sobre almacenamiento de objetos', 'delta iceberg lake bronze silver gold'],
    ['feature-store', 'database', 'Feature store', 'Variables listas para modelos', 'features ml'],
    ['bi-dashboard', 'frontend', 'Dashboard BI', 'Informes y cuadros de mando', 'bi dashboard looker metabase informes'],
    ['jupyter', 'notebook', 'Jupyter', 'Notebook de análisis en Python', 'jupyter notebook python análisis'],
    ['data-catalog', 'service', 'Catálogo de datos', 'Linaje y descubrimiento de datos', 'catalog linaje gobierno'],
    ['data-quality', 'function', 'Calidad de datos', 'Validaciones sobre los datasets', 'quality calidad tests great expectations'],
  ]),
  ...rows('observability', [
    ['metrics', 'observability', 'Métricas', 'Series numéricas agregadas', 'metrics prometheus'],
    ['logs', 'observability', 'Logs', 'Registros de eventos de aplicación', 'logs loki elk registros'],
    ['traces', 'observability', 'Trazas', 'Seguimiento distribuido de peticiones', 'tracing trazas jaeger tempo'],
    ['otel-collector', 'observability', 'Colector OpenTelemetry', 'Recibe y reenvía telemetría', 'otel opentelemetry collector'],
    ['alerting', 'observability', 'Alertas', 'Avisa cuando algo se degrada', 'alertas alerting pagerduty on call'],
    ['observability-dashboard', 'frontend', 'Panel de observabilidad', 'Visualiza telemetría', 'grafana dashboard panel'],
    ['uptime', 'observability', 'Monitor de disponibilidad', 'Sondas externas periódicas', 'uptime synthetic disponibilidad'],
  ]),
  ...rows('platform', [
    ['git-repo', 'repo', 'Repositorio Git', 'Fuente versionada del sistema', 'git github gitlab repo código'],
    ['ci-pipeline', 'workflow', 'Pipeline CI/CD', 'Compila, prueba y despliega', 'ci cd pipeline actions despliegue'],
    ['container-registry', 'registry', 'Registro de contenedores', 'Imágenes versionadas', 'registry ecr docker imágenes'],
    ['artifact-store', 'registry', 'Repositorio de artefactos', 'Paquetes y binarios publicados', 'artifacts npm maven paquetes'],
    ['iac', 'tool', 'Infraestructura como código', 'Define recursos de forma declarativa', 'terraform pulumi cloudformation iac'],
    ['api-spec', 'document', 'Especificación de API', 'Contrato OpenAPI o AsyncAPI', 'openapi asyncapi swagger contrato'],
    ['runbook', 'document', 'Runbook', 'Procedimiento de operación documentado', 'runbook playbook procedimiento'],
    ['feature-flags', 'service', 'Feature flags', 'Activa funciones sin desplegar', 'flags toggles experimentos'],
    ['config-store', 'storage', 'Configuración', 'Parámetros centralizados por entorno', 'config parámetros entorno'],
    ['cron', 'scheduler', 'Cron', 'Tareas programadas por expresión', 'cron scheduler programado'],
    ['workflow-engine', 'workflow', 'Motor de workflows', 'Orquesta pasos con estado y reintentos', 'workflow step functions temporal saga'],
  ]),
  ...rows('iot', [
    ['sensor', 'device', 'Sensor', 'Dispositivo que mide y emite lecturas', 'sensor dispositivo telemetría'],
    ['actuator', 'device', 'Actuador', 'Dispositivo que ejecuta órdenes', 'actuador control dispositivo'],
    ['camera', 'device', 'Cámara', 'Captura de vídeo o imagen', 'cámara vídeo visión'],
    ['wearable', 'device', 'Wearable', 'Dispositivo personal conectado', 'wearable reloj móvil salud'],
    ['plc', 'device', 'PLC', 'Controlador industrial', 'plc scada industrial'],
    ['edge-gateway', 'gateway', 'Gateway de borde', 'Agrega dispositivos en planta', 'edge gateway planta'],
    ['mqtt-broker', 'queue', 'Broker MQTT', 'Mensajería ligera para dispositivos', 'mqtt broker iot'],
    ['digital-twin', 'service', 'Gemelo digital', 'Estado virtual del activo físico', 'digital twin gemelo'],
    ['fleet-manager', 'service', 'Gestión de flota', 'Inventario y salud de dispositivos', 'fleet flota dispositivos'],
    ['ota', 'function', 'Actualizaciones OTA', 'Distribuye firmware a dispositivos', 'ota firmware actualización'],
  ]),
  ...rows('external', [
    ['payments', 'external', 'Pasarela de pagos', 'Cobros y suscripciones de terceros', 'pagos payments stripe checkout'],
    ['email', 'notification', 'Envío de email', 'Correo transaccional', 'email correo ses sendgrid'],
    ['sms', 'notification', 'SMS', 'Mensajes de texto y OTP', 'sms twilio otp'],
    ['push', 'notification', 'Notificaciones push', 'Avisos a dispositivos móviles', 'push notificaciones fcm apns'],
    ['crm', 'external', 'CRM', 'Clientes y oportunidades', 'crm salesforce hubspot'],
    ['erp', 'external', 'ERP', 'Gestión empresarial', 'erp sap'],
    ['product-analytics', 'observability', 'Analítica de producto', 'Eventos de uso del producto', 'analytics amplitude mixpanel'],
    ['maps', 'external', 'Mapas', 'Geocodificación y rutas', 'maps mapas geo'],
    ['third-party-api', 'external', 'API de terceros', 'Servicio externo fuera de tu control', 'external externa tercero saas'],
  ]),
];

const PRESETS_BY_ID = new Map(LIBRARY_PRESETS.map((preset) => [preset.id, preset]));

export function findPreset(id: string): LibraryPreset | undefined {
  return PRESETS_BY_ID.get(id);
}

/** Initial node content for a preset. Provider presets carry the generic-icon note. */
export function presetSeed(preset: LibraryPreset): NodeSeed {
  if (!preset.provider) return { kind: preset.kind, label: preset.label };
  return { kind: preset.kind, label: preset.label, provider: preset.provider, description: GENERIC_ICON_NOTE };
}

export function kindSeed(kind: NodeKind): NodeSeed {
  return { kind, label: KIND_INFO[kind].label };
}

/** Lower-case and accent-free, so «cache» finds «Caché». */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const CATEGORY_LABEL = new Map<LibraryCategoryId, string>(LIBRARY_CATEGORIES.map((category) => [category.id, category.label]));

const SEARCH_TEXT = new Map(
  LIBRARY_PRESETS.map((preset) => [
    preset.id,
    fold([preset.label, preset.summary, preset.provider ?? '', preset.kind, KIND_INFO[preset.kind].label, CATEGORY_LABEL.get(preset.category) ?? '', ...preset.tags].join(' ')),
  ]),
);

/** Presets whose text contains every word of the query, in library order. */
export function searchPresets(query: string): LibraryPreset[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...LIBRARY_PRESETS];
  return LIBRARY_PRESETS.filter((preset) => {
    const text = SEARCH_TEXT.get(preset.id) ?? '';
    return words.every((word) => text.includes(word));
  });
}
