import { DiagramBuilder } from '../builder';

const generic = 'Icono genérico; no es un logo oficial';

/** Inspired by the AWS distributed load testing reference: three domain platforms and a numbered path. */
export function awsLoadTesting() {
  return new DiagramBuilder({
    id: 'tpl-aws-load-testing',
    name: 'AWS Load Testing',
    description:
      'Consola y API para lanzar pruebas de carga, orquestación de ejecuciones y workers en contenedores dentro de una VPC, con métricas y resultados. Ejemplo ilustrativo, no una arquitectura desplegada.',
    styleId: 'porcelain',
  })
    .group('g-access', 'Frontend y API', { description: 'Acceso de los equipos de QA' })
    .group('g-orchestration', 'Orquestación de pruebas', { description: 'Define y coordina cada ejecución' })
    .group('g-region', 'Región AWS · ejecución', { kind: 'region' })
    .group('g-vpc', 'VPC', { kind: 'network', parent: 'g-region' })
    .group('g-cluster', 'Clúster de contenedores', { kind: 'cluster', parent: 'g-vpc' })
    .node('n-qa', 'client', 'Equipo de QA', [0, 0.4])
    .node('n-console', 'frontend', 'Consola web', [1.15, 0.4], {
      group: 'g-access',
      provider: 'AWS · CloudFront + S3',
      description: generic,
    })
    .node('n-api', 'api', 'API REST', [2.15, 0.4], {
      group: 'g-access',
      provider: 'AWS · API Gateway',
      description: generic,
    })
    .node('n-auth', 'service', 'Autenticación', [2.15, 1.6], {
      group: 'g-access',
      provider: 'AWS · Cognito',
      description: generic,
    })
    .node('n-dashboard', 'frontend', 'Panel de resultados', [1.15, 1.6], { group: 'g-access' })
    .node('n-launcher', 'function', 'Lanzador de pruebas', [3.45, 0.4], {
      group: 'g-orchestration',
      provider: 'AWS · Lambda',
    })
    .node('n-runner', 'service', 'Task runner', [4.45, 0.4], {
      group: 'g-orchestration',
      provider: 'AWS · Step Functions',
    })
    .node('n-scenarios', 'database', 'Escenarios', [3.45, 1.6], {
      group: 'g-orchestration',
      provider: 'AWS · DynamoDB',
    })
    .node('n-parser', 'function', 'Parser de resultados', [4.45, 1.6], {
      group: 'g-orchestration',
      provider: 'AWS · Lambda',
    })
    .node('n-worker-1', 'service', 'Worker de carga A', [6, 0.6], { group: 'g-cluster', provider: 'AWS · ECS Fargate' })
    .node('n-worker-2', 'service', 'Worker de carga B', [6, 1.6], { group: 'g-cluster', provider: 'AWS · ECS Fargate' })
    .node('n-worker-3', 'service', 'Worker de carga C', [6, 2.6], { group: 'g-cluster', provider: 'AWS · ECS Fargate' })
    .node('n-metrics', 'observability', 'Métricas y logs', [7.35, 0.6], {
      group: 'g-region',
      provider: 'AWS · CloudWatch',
    })
    .node('n-results', 'storage', 'Resultados', [7.35, 1.6], { group: 'g-region', provider: 'AWS · S3' })
    .node('n-registry', 'storage', 'Imágenes de contenedor', [7.35, 2.6], { group: 'g-region', provider: 'AWS · ECR' })
    .node('n-target', 'generic', 'Sistema bajo prueba', [8.85, 1.6], {
      description: 'Endpoint externo que recibe la carga',
    })
    .edge('n-qa', 'n-console', 'request', 'Configura prueba', {
      order: 1,
      explanation: 'El equipo define escenario, concurrencia y duración.',
    })
    .edge('n-console', 'n-auth', 'request', 'Login', { fromSide: 'bottom', toSide: 'left' })
    .edge('n-console', 'n-api', 'request', 'HTTPS', { order: 2, explanation: 'La consola llama a la API autenticada.' })
    .edge('n-api', 'n-launcher', 'request', 'Crear prueba', {
      order: 3,
      explanation: 'La API delega el alta de la prueba en una función.',
    })
    .edge('n-launcher', 'n-scenarios', 'data', 'Guarda escenario', { order: 4 })
    .edge('n-launcher', 'n-runner', 'control', 'Inicia ejecución', {
      order: 5,
      explanation: 'El task runner coordina el ciclo de vida de los workers.',
    })
    .edge('n-runner', 'n-worker-1', 'control', 'Lanza tareas', {
      order: 6,
      explanation: 'Se arrancan tantas tareas como pida la concurrencia.',
    })
    .edge('n-runner', 'n-worker-2', 'control', undefined, { order: 6 })
    .edge('n-runner', 'n-worker-3', 'control', undefined, { order: 6 })
    .edge('n-registry', 'n-worker-3', 'dependency', 'Imagen')
    .edge('n-worker-1', 'n-target', 'request', 'Carga sintética', {
      order: 7,
      explanation: 'Los workers generan peticiones contra el sistema bajo prueba.',
    })
    .edge('n-worker-2', 'n-target', 'request', undefined, { order: 7 })
    .edge('n-worker-3', 'n-target', 'request', undefined, { order: 7 })
    .edge('n-worker-1', 'n-metrics', 'telemetry', 'Métricas', { order: 8 })
    .edge('n-runner', 'n-parser', 'event', 'Fin de ejecución', { order: 9 })
    .edge('n-parser', 'n-results', 'data', 'Informe', {
      order: 10,
      explanation: 'Se agregan latencias y errores en un informe.',
    })
    .edge('n-dashboard', 'n-api', 'request', 'Consulta resultados', { order: 11 })
    .build();
}
