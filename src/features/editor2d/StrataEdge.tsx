import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { RELATION_INFO } from '../../domain/catalog';
import type { FlowEdge } from './adapter';
import { RELATION_STROKE } from './visual';

export const StrataEdge = memo(function StrataEdge(props: EdgeProps<FlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10, offset: 20 });
  const edge = data?.edge;
  if (!edge) return null;
  const stroke = RELATION_STROKE[edge.relation];
  const markerId = selected ? 'strata-arrow-selected' : `strata-arrow-${edge.relation}`;
  const text = [edge.order !== undefined ? String(edge.order) : null, edge.label].filter(Boolean).join(' · ');
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        {...(edge.direction === 'bidirectional' ? { markerStart: `url(#${markerId})` } : {})}
        interactionWidth={16}
        style={{
          stroke: selected ? 'var(--signal)' : stroke.color,
          strokeWidth: selected ? 2.25 : 1.5,
          ...(stroke.dash ? { strokeDasharray: stroke.dash } : {}),
        }}
      />
      {text ? (
        <EdgeLabelRenderer>
          <div
            className={`strata-edge-label${selected ? ' is-selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={RELATION_INFO[edge.relation].label}
          >
            {text}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

/** Arrow markers referenced by edges, one per relation colour. */
export function EdgeMarkers() {
  return (
    <svg className="strata-markers" aria-hidden="true">
      <defs>
        {Object.entries(RELATION_STROKE).map(([relation, stroke]) => (
          <marker key={relation} id={`strata-arrow-${relation}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10Z" fill={stroke.color} />
          </marker>
        ))}
        <marker id="strata-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10Z" style={{ fill: 'var(--signal)' }} />
        </marker>
      </defs>
    </svg>
  );
}
