import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import { memo, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { RELATION_INFO } from '../../domain/catalog';
import { updateEdge } from '../../domain/commands';
import type { DiagramEdge } from '../../domain/types';
import { useDocumentStore } from '../../state/documentStore';
import { usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import type { FlowEdge } from './adapter';
import { bendAxis, strataEdgePath } from './edgePath';
import { RELATION_STROKE } from './visual';

type Bend = NonNullable<DiagramEdge['bend']>;

const GRID = 16;

function commitBend(id: string, bend: Bend | undefined) {
  const result = useDocumentStore.getState().execute(bend ? 'Mover relación' : 'Restablecer trazado', (doc) => updateEdge(doc, id, { bend }));
  if (!result.ok) useUiStore.getState().notify('error', result.error);
}

export const StrataEdge = memo(function StrataEdge(props: EdgeProps<FlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const { getZoom } = useReactFlow();
  const snap = usePreferences((state) => state.snapToGrid);
  // Local offset while dragging; the document only changes on release.
  const [draft, setDraft] = useState<Bend | null>(null);
  const edge = data?.edge;
  const ends = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, labelX, labelY] = strataEdgePath(ends, draft ?? edge?.bend);
  if (!edge) return null;
  const axis = bendAxis(ends);
  const bendable = selected && axis !== null;

  // Drags the middle segment along its free axis, like nudging a connector in Figma.
  const startBend = (event: ReactPointerEvent) => {
    if (!axis || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.stopPropagation();
    event.preventDefault();
    const zoom = getZoom();
    const origin = { x: event.clientX, y: event.clientY };
    const base = edge.bend ?? { x: 0, y: 0 };
    const mid = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
    let latest: Bend | null = null;
    const move = (moveEvent: PointerEvent) => {
      const delta = axis === 'x' ? (moveEvent.clientX - origin.x) / zoom : (moveEvent.clientY - origin.y) / zoom;
      if (latest === null && Math.abs(delta) * zoom < 3) return;
      let offset = (axis === 'x' ? base.x : base.y) + delta;
      // Snap the segment itself (not the offset) onto the canvas grid.
      if (snap) offset = Math.round((mid[axis] + offset) / GRID) * GRID - mid[axis];
      latest = axis === 'x' ? { x: Math.round(offset), y: 0 } : { x: 0, y: Math.round(offset) };
      setDraft(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDraft(null);
      if (latest) commitBend(id, latest.x === 0 && latest.y === 0 ? undefined : latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const resetBend = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (edge.bend) commitBend(id, undefined);
  };

  const grab = bendable ? { onPointerDown: startBend, onDoubleClick: resetBend } : {};
  const cursor = axis === 'x' ? 'ew-resize' : 'ns-resize';
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
      {bendable ? <path className="strata-edge-grab nodrag nopan" d={path} style={{ cursor }} {...grab} /> : null}
      {text || bendable ? (
        <EdgeLabelRenderer>
          {text ? (
            <div
              className={`strata-edge-label${selected ? ' is-selected' : ''}${bendable ? ' nodrag nopan' : ''}`}
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, ...(bendable ? { cursor } : {}) }}
              title={bendable ? 'Arrastra para mover el trazado · doble clic para restablecer' : RELATION_INFO[edge.relation].label}
              {...grab}
            >
              {text}
            </div>
          ) : (
            <div
              className="strata-edge-grip nodrag nopan"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, cursor }}
              title="Arrastra para mover el trazado · doble clic para restablecer"
              {...grab}
            />
          )}
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
