import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { KIND_INFO } from '../../domain/catalog';
import { portFraction } from '../../domain/geometry';
import type { Port } from '../../domain/types';
import type { StrataFlowNode } from './adapter';
import { domainAccentVar, KIND_GLYPH } from './visual';

const POSITION: Record<Port['side'], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

function handleStyle(port: Port, ports: readonly Port[]) {
  const fraction = `${portFraction(port, ports) * 100}%`;
  return port.side === 'top' || port.side === 'bottom' ? { left: fraction } : { top: fraction };
}

const DIRECTION_LABEL: Record<Port['direction'], string> = { in: 'entrada', out: 'salida', inout: 'entrada/salida' };

export const StrataNode = memo(function StrataNode({ data, selected }: NodeProps<StrataFlowNode>) {
  const { node, accent } = data;
  const info = KIND_INFO[node.kind];
  return (
    <div
      className={`strata-node strata-node--${node.kind}${selected ? ' is-selected' : ''}`}
      style={{ '--accent': domainAccentVar(accent) } as React.CSSProperties}
    >
      <svg className="strata-node__glyph" viewBox="0 0 20 20" aria-hidden="true">
        <path d={KIND_GLYPH[node.kind]} />
      </svg>
      <div className="strata-node__text">
        <span className="strata-node__kind">{info.label}</span>
        <span className="strata-node__label">{node.label}</span>
        {node.provider ? <span className="strata-node__provider">{node.provider}</span> : null}
      </div>
      {node.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={POSITION[port.side]}
          style={handleStyle(port, node.ports)}
          className={`strata-handle strata-handle--${port.direction}`}
          // Pointer-only drag targets: keyboard and screen-reader users connect from the inspector
          // («Conectar con…»), so the handle is not announced (an aria-label needs a role).
          title={`${port.label ?? port.id} · ${DIRECTION_LABEL[port.direction]} · ${port.dataType}`}
        />
      ))}
    </div>
  );
});
