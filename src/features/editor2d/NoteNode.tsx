import { NodeResizer, useInternalNode, type NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { resizeElement } from '../../domain/commands';
import { leaderLine } from '../../domain/geometry';
import { updateAnnotation } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import type { NoteFlowNode } from './adapter';

/**
 * Live leader from the note to its node. Both ends follow in-flight drags:
 * the note through its own props, the target through React Flow internals.
 */
function Leader({ targetId, x, y, width, height }: { targetId: string; x: number; y: number; width: number; height: number }) {
  const target = useInternalNode(targetId);
  if (!target) return null;
  const rect = { x: target.internals.positionAbsolute.x, y: target.internals.positionAbsolute.y, width: target.measured.width ?? target.width ?? 0, height: target.measured.height ?? target.height ?? 0 };
  const line = leaderLine({ x, y, width, height }, rect);
  if (!line) return null;
  return (
    <svg className="strata-note__leader" aria-hidden="true">
      <line x1={line.from.x - x} y1={line.from.y - y} x2={line.to.x - x} y2={line.to.y - y} />
      <circle cx={line.to.x - x} cy={line.to.y - y} r={2.5} />
    </svg>
  );
}

export const NoteNode = memo(function NoteNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY, width, height }: NodeProps<NoteFlowNode>) {
  const { annotation } = data;
  const readOnly = useDocumentStore((state) => state.readOnly !== null);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== annotation.text) updateAnnotation(id, { text: draft });
    setDraft(null);
  };
  return (
    <div className={`strata-note${selected ? ' is-selected' : ''}`} onDoubleClick={() => !readOnly && setDraft(annotation.text)}>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={120}
        minHeight={48}
        lineClassName="strata-group__resize-line"
        handleClassName="strata-group__resize-handle"
        onResizeEnd={(_event, params) => {
          const result = useDocumentStore.getState().execute('Redimensionar nota', (doc) => resizeElement(doc, { type: 'annotation', id }, params));
          if (!result.ok) useUiStore.getState().notify('error', result.error);
        }}
      />
      {annotation.targetNodeId ? <Leader targetId={annotation.targetNodeId} x={positionAbsoluteX} y={positionAbsoluteY} width={width ?? 0} height={height ?? 0} /> : null}
      <span className="strata-note__eyebrow">Nota</span>
      {draft !== null ? (
        <textarea
          className="strata-note__editor nodrag nowheel"
          aria-label="Texto de la nota"
          value={draft}
          // Opened by an explicit double click, so focusing it is expected.
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null);
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commit();
          }}
        />
      ) : (
        <p className="strata-note__text">{annotation.text}</p>
      )}
    </div>
  );
});
