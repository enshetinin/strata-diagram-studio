/**
 * Accessible list of the whole graph: works without any canvas. Selecting an
 * entry selects it in both views; groups can be isolated in 3D.
 */
import { Crosshair, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { KIND_INFO, RELATION_INFO } from '../../domain/catalog';
import type { DiagramDocument, ElementRef } from '../../domain/types';
import { useDocumentStore } from '../../state/documentStore';
import { isSelected, useUiStore } from '../../state/uiStore';

function Entry({ refValue, children, secondary }: { refValue: ElementRef; children: ReactNode; secondary?: ReactNode }) {
  const selection = useUiStore((state) => state.selection);
  const selected = isSelected(selection, refValue);
  return (
    <div className={`outline-entry${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="outline-entry__main"
        aria-pressed={selected}
        onClick={(event) => {
          const ui = useUiStore.getState();
          if (event.shiftKey || event.metaKey || event.ctrlKey) ui.toggleSelect(refValue);
          else ui.select([refValue]);
        }}
      >
        {children}
      </button>
      {secondary}
      {refValue.type !== 'edge' ? (
        <button type="button" className="icon-button icon-button--small" aria-label="Enfocar en la vista" title="Enfocar en la vista" onClick={() => useUiStore.getState().focus(refValue)}>
          <Crosshair size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function GroupTree({ doc, parentId }: { doc: DiagramDocument; parentId: string | null }) {
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const groups = doc.groups.filter((group) => group.parentGroupId === parentId);
  const nodes = doc.nodes.filter((node) => node.groupId === parentId);
  if (groups.length === 0 && nodes.length === 0) return null;
  return (
    <ul className="outline-tree">
      {groups.map((group) => (
        <li key={group.id}>
          <Entry
            refValue={{ type: 'group', id: group.id }}
            secondary={
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-pressed={isolated === group.id}
                aria-label={isolated === group.id ? `Dejar de aislar ${group.label}` : `Aislar ${group.label} en 3D`}
                title={isolated === group.id ? 'Mostrar todo' : 'Aislar en 3D'}
                onClick={() => useUiStore.getState().isolateGroup(isolated === group.id ? null : group.id)}
              >
                {isolated === group.id ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            }
          >
            <span className="outline-entry__kind">Grupo</span> {group.label}
          </Entry>
          <GroupTree doc={doc} parentId={group.id} />
        </li>
      ))}
      {nodes.map((node) => (
        <li key={node.id}>
          <Entry refValue={{ type: 'node', id: node.id }}>
            <span className="outline-entry__kind">{KIND_INFO[node.kind].label}</span> {node.label}
          </Entry>
        </li>
      ))}
    </ul>
  );
}

export function OutlinePanel() {
  const doc = useDocumentStore((state) => state.doc);
  const label = (id: string) => doc.nodes.find((node) => node.id === id)?.label ?? id;
  const edges = [...doc.edges].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  return (
    <div className="panel-section">
      <p className="panel-intro">
        {doc.nodes.length} componentes · {doc.edges.length} relaciones · {doc.groups.length} grupos. Mayús/Ctrl + clic para seleccionar varios.
      </p>
      <h3 className="panel-heading">Componentes</h3>
      <GroupTree doc={doc} parentId={null} />
      <h3 className="panel-heading">Relaciones</h3>
      <ul className="outline-tree">
        {edges.map((edge) => (
          <li key={edge.id}>
            <Entry refValue={{ type: 'edge', id: edge.id }}>
              <span className="outline-entry__kind">{edge.order !== undefined ? `${edge.order} · ` : ''}{RELATION_INFO[edge.relation].label}</span> {label(edge.source.nodeId)} {edge.direction === 'bidirectional' ? '↔' : '→'} {label(edge.target.nodeId)}
              {edge.label ? <span className="outline-entry__meta"> «{edge.label}»</span> : null}
            </Entry>
          </li>
        ))}
      </ul>
      {doc.annotations.length > 0 ? (
        <>
          <h3 className="panel-heading">Notas</h3>
          <ul className="outline-tree">
            {doc.annotations.map((annotation) => (
              <li key={annotation.id}>
                <Entry refValue={{ type: 'annotation', id: annotation.id }}>
                  <span className="outline-entry__kind">Nota{annotation.targetNodeId ? ` → ${label(annotation.targetNodeId)}` : ''}</span> {annotation.text}
                </Entry>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
