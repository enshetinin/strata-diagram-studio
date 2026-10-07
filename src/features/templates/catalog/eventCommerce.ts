import { DiagramBuilder } from '../builder';

/** Main order flow with consumer branches, event returns to the bus and a dead-letter loop. */
export function eventCommerce() {
  return new DiagramBuilder({
    id: 'tpl-event-commerce',
    name: 'Comercio por eventos',
    description:
      'Gateway, servicio de pedidos y bus de eventos con consumidores de pagos, inventario y notificaciones; los fallos acaban en una DLQ con reproceso. Ejemplo ilustrativo.',
    styleId: 'monochrome',
  })
    .group('g-edge', 'Borde', { kind: 'zone' })
    .group('g-orders', 'Dominio de pedidos')
    .group('g-bus', 'Bus de eventos', { kind: 'cluster' })
    .group('g-consumers', 'Consumidores')
    .group('g-recovery', 'Recuperación', { kind: 'zone' })
    .node('n-customer', 'client', 'Cliente', [0, 1])
    .node('n-gateway', 'gateway', 'API Gateway', [1.3, 1], { group: 'g-edge' })
    .node('n-orders', 'service', 'Servicio de pedidos', [2.6, 1], { group: 'g-orders' })
    .node('n-orders-db', 'database', 'Pedidos', [2.6, 2.2], { group: 'g-orders' })
    .node('n-bus', 'queue', 'Event bus', [4, 1], { group: 'g-bus' })
    .node('n-payments', 'service', 'Pagos', [5.5, 0], { group: 'g-consumers' })
    .node('n-inventory', 'service', 'Inventario', [5.5, 1.1], { group: 'g-consumers' })
    .node('n-notify', 'function', 'Notificaciones', [5.5, 2.2], { group: 'g-consumers' })
    .node('n-stock', 'cache', 'Reservas de stock', [6.6, 1.1], { group: 'g-consumers' })
    .node('n-psp', 'generic', 'Pasarela de pago externa', [8, 0])
    .node('n-dlq', 'queue', 'Dead-letter queue', [4, 3.6], { group: 'g-recovery' })
    .node('n-retry', 'function', 'Reproceso', [5.3, 3.6], { group: 'g-recovery' })
    .edge('n-customer', 'n-gateway', 'request', 'POST /orders', { order: 1 })
    .edge('n-gateway', 'n-orders', 'request', 'Crear pedido', { order: 2 })
    .edge('n-orders', 'n-orders-db', 'data', 'Persistir', { order: 3 })
    .edge('n-orders', 'n-bus', 'event', 'OrderPlaced', {
      order: 4,
      explanation: 'El pedido se publica una sola vez; los consumidores reaccionan de forma independiente.',
    })
    .edge('n-bus', 'n-payments', 'event', 'OrderPlaced', { order: 5, fromSide: 'top', toSide: 'left' })
    .edge('n-payments', 'n-psp', 'request', 'Cobro', { order: 6 })
    .edge('n-payments', 'n-bus', 'event', 'PaymentConfirmed', {
      order: 7,
      fromSide: 'bottom',
      toSide: 'top',
      explanation: 'Retorno al bus: el pago confirmado es otro evento.',
    })
    .edge('n-bus', 'n-inventory', 'event', 'PaymentConfirmed', { order: 8 })
    .edge('n-inventory', 'n-stock', 'data', 'Reserva stock', { order: 9 })
    .edge('n-inventory', 'n-bus', 'event', 'StockReserved', { order: 10, fromSide: 'bottom', toSide: 'bottom' })
    .edge('n-bus', 'n-notify', 'event', 'StockReserved', { order: 11, fromSide: 'right', toSide: 'left' })
    .edge('n-bus', 'n-orders', 'event', 'Estado del pedido', { order: 12, fromSide: 'left', toSide: 'right' })
    .edge('n-bus', 'n-dlq', 'async', 'Tras 3 reintentos')
    .edge('n-dlq', 'n-retry', 'event', 'Reproceso')
    .edge('n-retry', 'n-bus', 'async', 'Reencola', { fromSide: 'top', toSide: 'right' })
    .build();
}
