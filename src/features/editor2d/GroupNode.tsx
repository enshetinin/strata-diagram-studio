import { type NodeProps, NodeResizer } from '@xyflow/react';
import { memo } from 'react';
import { GROUP_KIND_LABEL } from '../../domain/catalog';
import { resizeElement } from '../../domain/commands';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import type { GroupFlowNode } from './adapter';
import { domainAccentVar } from './visual';

export const GroupNode = memo(function GroupNode({ id, data, selected }: NodeProps<GroupFlowNode>) {
  const { group, accent, depth } = data;
  return (
    <div
      className={`strata-group${selected ? ' is-selected' : ''}`}
      data-depth={depth}
      data-kind={group.kind}
      style={{ '--accent': domainAccentVar(accent) } as React.CSSProperties}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        lineClassName="strata-group__resize-line"
        handleClassName="strata-group__resize-handle"
        onResizeEnd={(_event, params) => {
          const result = useDocumentStore
            .getState()
            .execute('Redimensionar grupo', (doc) => resizeElement(doc, { type: 'group', id }, params));
          if (!result.ok) useUiStore.getState().notify('error', result.error);
        }}
      />
      <div className="strata-group__handle">
        <span className="strata-group__kind">{GROUP_KIND_LABEL[group.kind]}</span>
        <span className="strata-group__label" title={group.label}>
          {group.label}
        </span>
      </div>
    </div>
  );
});
