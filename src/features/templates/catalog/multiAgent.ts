import { DiagramBuilder } from '../builder';

/** Coordinator in the middle, specialists as satellites, tools and memory on the flanks. */
export function multiAgent() {
  return new DiagramBuilder({
    id: 'tpl-multi-agent',
    name: 'Sistema multiagente',
    description:
      'Un coordinador reparte subtareas a agentes especializados que usan herramientas y comparten memoria; la revisión puede devolver trabajo (ciclo legítimo). Ilustrativo: la app no ejecuta agentes.',
    styleId: 'midnight',
  })
    .group('g-core', 'Núcleo de coordinación', { kind: 'cluster' })
    .group('g-tools', 'Herramientas', { kind: 'zone' })
    .group('g-memory', 'Memoria compartida', { kind: 'zone' })
    .node('n-user', 'client', 'Usuario', [-0.6, 0])
    .node('n-api', 'api', 'API de tareas', [0.9, 0])
    .node('n-planner', 'agent', 'Agente planificador', [2.5, 0])
    .node('n-coordinator', 'agent', 'Coordinador', [2.5, 1.6], { group: 'g-core' })
    .node('n-bus', 'queue', 'Cola de subtareas', [2.5, 2.6], { group: 'g-core' })
    .node('n-researcher', 'agent', 'Agente investigador', [0.9, 1.6])
    .node('n-coder', 'agent', 'Agente programador', [4.1, 1.6])
    .node('n-reviewer', 'agent', 'Agente revisor', [2.5, 3.9])
    .node('n-llm', 'model', 'Modelo base', [4.1, 3.9], { description: 'Proveedor de modelo intercambiable' })
    .node('n-search', 'tool', 'Búsqueda web', [5.6, 0.6], { group: 'g-tools' })
    .node('n-sandbox', 'tool', 'Sandbox de código', [5.6, 1.6], { group: 'g-tools' })
    .node('n-repo', 'tool', 'Repositorio', [5.6, 2.6], { group: 'g-tools' })
    .node('n-vector', 'database', 'Memoria vectorial', [-0.6, 1.1], { group: 'g-memory' })
    .node('n-episodes', 'storage', 'Historial de episodios', [-0.6, 2.1], { group: 'g-memory' })
    .edge('n-user', 'n-api', 'request', 'Objetivo', { order: 1 })
    .edge('n-api', 'n-coordinator', 'request', 'Tarea', { order: 2, fromSide: 'bottom', toSide: 'left' })
    .edge('n-coordinator', 'n-planner', 'control', 'Planificar', { order: 3 })
    .edge('n-planner', 'n-coordinator', 'response', 'Plan', { order: 4, fromSide: 'right', toSide: 'right' })
    .edge('n-coordinator', 'n-bus', 'event', 'Subtareas', { order: 5 })
    .edge('n-bus', 'n-researcher', 'event', 'Investigar', { order: 6, fromSide: 'left', toSide: 'bottom' })
    .edge('n-bus', 'n-coder', 'event', 'Implementar', { order: 6, fromSide: 'right', toSide: 'bottom' })
    .edge('n-researcher', 'n-coder', 'data', 'Contexto técnico', { fromSide: 'top', toSide: 'top' })
    .edge('n-researcher', 'n-search', 'request', 'Consulta', { order: 7, fromSide: 'top', toSide: 'left' })
    .edge('n-coder', 'n-sandbox', 'request', 'Ejecuta tests', { order: 8 })
    .edge('n-coder', 'n-repo', 'request', 'Propone cambio', { order: 8, fromSide: 'right', toSide: 'left' })
    .edge('n-coder', 'n-reviewer', 'request', 'Revisión', { order: 9, fromSide: 'bottom', toSide: 'right' })
    .edge('n-reviewer', 'n-coder', 'control', 'Cambios solicitados', {
      order: 10,
      fromSide: 'top',
      toSide: 'left',
      explanation: 'Ciclo de revisión: válido en el grafo.',
    })
    .edge('n-reviewer', 'n-coordinator', 'response', 'Aprobado', { order: 11, fromSide: 'left', toSide: 'left' })
    .edge('n-researcher', 'n-vector', 'data', 'Hallazgos')
    .edge('n-coordinator', 'n-episodes', 'data', 'Contexto', {
      direction: 'bidirectional',
      fromSide: 'left',
      toSide: 'right',
    })
    .edge('n-reviewer', 'n-llm', 'dependency', 'Inferencia')
    .edge('n-coder', 'n-llm', 'dependency', undefined, { fromSide: 'bottom', toSide: 'top' })
    .build();
}
