import { DiagramBuilder } from '../builder';

/** Separate field clusters converging on one cloud region, with OTA updates flowing back. */
export function edgeIot() {
  return new DiagramBuilder({
    id: 'tpl-edge-iot',
    name: 'Edge / IoT',
    description:
      'Dos plantas y una flota móvil envían telemetría a través de gateways de borde a una región cloud con broker, reglas, almacenamiento y monitorización; las actualizaciones OTA vuelven a los gateways. Ejemplo ilustrativo.',
    styleId: 'porcelain',
    appearance: { connectorRoute: 'arc' },
    projection: 'perspective',
  })
    .group('g-north', 'Planta Norte', { kind: 'zone' })
    .group('g-south', 'Planta Sur', { kind: 'zone' })
    .group('g-fleet', 'Flota móvil', { kind: 'zone' })
    .group('g-cloud', 'Región cloud', { kind: 'region' })
    .group('g-ingestion', 'Ingesta', { kind: 'cluster', parent: 'g-cloud' })
    .node('n-vibration', 'client', 'Sensores de vibración', [0, 0], { group: 'g-north' })
    .node('n-cameras', 'client', 'Cámaras de línea', [0, 1.1], { group: 'g-north' })
    .node('n-gw-north', 'gateway', 'Gateway de borde N', [1.2, 0.55], { group: 'g-north' })
    .node('n-inference', 'model', 'Inferencia local', [1.2, 1.65], { group: 'g-north' })
    .node('n-meters', 'client', 'Medidores de energía', [0, 3.2], { group: 'g-south' })
    .node('n-plc', 'generic', 'PLC de línea', [0, 4.3], { group: 'g-south' })
    .node('n-gw-south', 'gateway', 'Gateway de borde S', [1.2, 3.75], { group: 'g-south' })
    .node('n-vehicles', 'client', 'Vehículos conectados', [0, 5.6], { group: 'g-fleet' })
    .node('n-cell', 'gateway', 'Pasarela celular', [1.2, 5.6], { group: 'g-fleet' })
    .node('n-broker', 'queue', 'Broker MQTT', [3.2, 2.6], { group: 'g-ingestion' })
    .node('n-rules', 'function', 'Reglas de ingesta', [4.4, 2.6], { group: 'g-ingestion' })
    .node('n-tsdb', 'database', 'Series temporales', [5.75, 1.9], { group: 'g-cloud' })
    .node('n-archive', 'storage', 'Archivo de telemetría', [5.75, 3.3], { group: 'g-cloud' })
    .node('n-ota', 'service', 'Servicio OTA', [4.4, 4.1], { group: 'g-cloud' })
    .node('n-monitor', 'observability', 'Monitorización', [7, 1.9], { group: 'g-cloud' })
    .node('n-ops-panel', 'frontend', 'Panel de operaciones', [7, 3.3], { group: 'g-cloud' })
    .node('n-operator', 'client', 'Operaciones', [8.4, 3.3])
    .edge('n-vibration', 'n-gw-north', 'telemetry', 'MQTT local', { order: 1 })
    .edge('n-cameras', 'n-gw-north', 'telemetry', undefined, { order: 1 })
    .edge('n-meters', 'n-gw-south', 'telemetry', 'Modbus', { order: 1 })
    .edge('n-plc', 'n-gw-south', 'telemetry', undefined, { order: 1 })
    .edge('n-vehicles', 'n-cell', 'telemetry', 'LTE', { order: 1 })
    .edge('n-gw-north', 'n-inference', 'data', 'Ventanas de señal', { order: 2 })
    .edge('n-inference', 'n-gw-north', 'event', 'Anomalías', { order: 3, fromSide: 'right', toSide: 'right' })
    .edge('n-gw-north', 'n-broker', 'telemetry', 'MQTT/TLS', {
      order: 4,
      explanation: 'Los tres clusters convergen en el broker regional.',
    })
    .edge('n-gw-south', 'n-broker', 'telemetry', undefined, { order: 4 })
    .edge('n-cell', 'n-broker', 'telemetry', undefined, { order: 4, fromSide: 'right', toSide: 'bottom' })
    .edge('n-broker', 'n-rules', 'event', 'Telemetría', { order: 5 })
    .edge('n-rules', 'n-tsdb', 'data', 'Puntos', { order: 6 })
    .edge('n-rules', 'n-archive', 'data', 'Lotes crudos', { order: 6 })
    .edge('n-tsdb', 'n-monitor', 'data', 'Alertas', { order: 7 })
    .edge('n-tsdb', 'n-ops-panel', 'data', 'Consultas', { order: 8, fromSide: 'bottom', toSide: 'left' })
    .edge('n-operator', 'n-ops-panel', 'request', 'Supervisa', { order: 9 })
    .edge('n-operator', 'n-ota', 'control', 'Aprueba firmware', { order: 10, fromSide: 'bottom', toSide: 'bottom' })
    .edge('n-ota', 'n-gw-north', 'control', 'OTA', { order: 11, fromSide: 'left', toSide: 'bottom' })
    .edge('n-ota', 'n-gw-south', 'control', undefined, { order: 11, fromSide: 'left', toSide: 'right' })
    .edge('n-ota', 'n-cell', 'control', undefined, { order: 11, fromSide: 'bottom', toSide: 'top' })
    .build();
}
