import { ArrowLeftRight, Copy, Crosshair, Plus, Trash2, Ungroup } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as cmd from '../../domain/commands';
import { effectiveNarrative } from '../../domain/narrative';
import { GROUP_KIND_LABEL, KIND_INFO, RELATION_INFO } from '../../domain/catalog';
import {
  EDGE_DIRECTIONS,
  GROUP_KINDS,
  NODE_KINDS,
  PORT_DATA_TYPES,
  PORT_DIRECTIONS,
  PORT_SIDES,
  RELATION_KINDS,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type JsonObject,
  type Port,
} from '../../domain/types';
import { deleteSelection, duplicateSelection, groupSelection, ungroupSelection } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { selectPrimary, useUiStore } from '../../state/uiStore';
import { SelectField, TextField } from '../../components/ui/fields';

function run(label: string, command: (doc: DiagramDocument) => DiagramDocument) {
  const result = useDocumentStore.getState().execute(label, command);
  if (!result.ok) useUiStore.getState().notify('error', result.error);
}

function groupOptions(doc: DiagramDocument, exclude: Set<string> = new Set()) {
  const depth = (group: DiagramGroup) => {
    let d = 0;
    let parent = group.parentGroupId;
    while (parent && d < 50) {
      d += 1;
      parent = doc.groups.find((candidate) => candidate.id === parent)?.parentGroupId ?? null;
    }
    return d;
  };
  return [
    { value: '__none__', label: 'Sin grupo (lienzo)' },
    ...doc.groups.filter((group) => !exclude.has(group.id)).map((group) => ({ value: group.id, label: `${'— '.repeat(depth(group))}${group.label}` })),
  ];
}

function ElementActions({ type, id }: { type: 'node' | 'group'; id: string }) {
  const mode = useUiStore((state) => state.mode);
  return (
    <div className="button-row">
      <button type="button" className="button" onClick={() => useUiStore.getState().focus({ type, id })}>
        <Crosshair size={15} aria-hidden="true" /> Enfocar
      </button>
      <button
        type="button"
        className="button"
        onClick={() => {
          const ui = useUiStore.getState();
          ui.setMode(mode === '3d' ? '2d' : '3d');
          ui.focus({ type, id });
        }}
      >
        {mode === '3d' ? 'Editar en 2D' : 'Ver en 3D'}
      </button>
    </div>
  );
}

function PortsEditor({ node }: { node: DiagramNode }) {
  const update = (ports: Port[], label = 'Editar puertos') => run(label, (doc) => cmd.setNodePorts(doc, node.id, ports));
  const patch = (index: number, change: Partial<Port>) => update(node.ports.map((port, i) => (i === index ? { ...port, ...change } : port)));
  const nextPortId = () => {
    let index = node.ports.length + 1;
    while (node.ports.some((port) => port.id === `p-${index}`)) index += 1;
    return `p-${index}`;
  };
  return (
    <fieldset className="ports">
      <legend>Puertos tipados</legend>
      <table className="ports__table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Lado</th>
            <th scope="col">Dirección</th>
            <th scope="col">Tipo</th>
            <th scope="col">
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {node.ports.map((port, index) => (
            <tr key={port.id}>
              <th scope="row">
                <code>{port.id}</code>
              </th>
              <td>
                <select aria-label={`Lado de ${port.id}`} value={port.side} onChange={(event) => patch(index, { side: event.target.value as Port['side'] })}>
                  {PORT_SIDES.map((side) => (
                    <option key={side} value={side}>
                      {{ top: 'arriba', right: 'derecha', bottom: 'abajo', left: 'izquierda' }[side]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select aria-label={`Dirección de ${port.id}`} value={port.direction} onChange={(event) => patch(index, { direction: event.target.value as Port['direction'] })}>
                  {PORT_DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {{ in: 'entrada', out: 'salida', inout: 'ambas' }[direction]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select aria-label={`Tipo de datos de ${port.id}`} value={port.dataType} onChange={(event) => patch(index, { dataType: event.target.value as Port['dataType'] })}>
                  {PORT_DATA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  aria-label={`Quitar puerto ${port.id} (y sus relaciones)`}
                  title="Quitar puerto y sus relaciones"
                  disabled={node.ports.length <= 1}
                  onClick={() => update(node.ports.filter((_, i) => i !== index), 'Quitar puerto')}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="button button--small" onClick={() => update([...node.ports, { id: nextPortId(), side: 'right', direction: 'out', dataType: 'any' }], 'Añadir puerto')}>
        <Plus size={14} aria-hidden="true" /> Añadir puerto
      </button>
    </fieldset>
  );
}

function MetadataField({ node }: { node: DiagramNode }) {
  const id = useId();
  const text = JSON.stringify(node.metadata, null, 2);
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(text), [text]);
  return (
    <div className="field">
      <label htmlFor={id}>Metadatos (JSON)</label>
      <textarea
        id={id}
        className="mono"
        rows={3}
        value={draft}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === text) return;
          try {
            const value: unknown = JSON.parse(draft || '{}');
            if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Debe ser un objeto JSON.');
            setError(null);
            run('Editar metadatos', (doc) => cmd.updateNode(doc, node.id, { metadata: value as JsonObject }));
          } catch (parseError) {
            setError(parseError instanceof Error ? parseError.message : 'JSON no válido');
          }
        }}
      />
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error} No se ha aplicado.
        </p>
      ) : null}
    </div>
  );
}

function NodeInspector({ node, doc }: { node: DiagramNode; doc: DiagramDocument }) {
  return (
    <>
      <p className="inspector__kind">{KIND_INFO[node.kind].label}</p>
      <TextField label="Etiqueta" value={node.label} onCommit={(label) => run('Editar etiqueta', (d) => cmd.updateNode(d, node.id, { label }))} />
      <TextField label="Descripción" value={node.description ?? ''} multiline onCommit={(description) => run('Editar descripción', (d) => cmd.updateNode(d, node.id, { description: description || undefined }))} />
      <SelectField label="Tipo" value={node.kind} options={NODE_KINDS.map((kind) => ({ value: kind, label: KIND_INFO[kind].label }))} onChange={(kind) => run('Cambiar tipo', (d) => cmd.updateNode(d, node.id, { kind }))} />
      <TextField label="Proveedor" value={node.provider ?? ''} placeholder="p. ej. AWS · Lambda" hint="Texto libre; no implica logos oficiales." onCommit={(provider) => run('Editar proveedor', (d) => cmd.updateNode(d, node.id, { provider: provider || undefined }))} />
      <SelectField
        label="Grupo"
        value={node.groupId ?? '__none__'}
        options={groupOptions(doc)}
        hint="Conserva la posición absoluta al cambiar de grupo."
        onChange={(value) => run('Cambiar grupo', (d) => cmd.setNodeGroup(d, node.id, value === '__none__' ? null : value))}
      />
      <PortsEditor node={node} />
      <MetadataField node={node} />
      <ElementActions type="node" id={node.id} />
      <div className="button-row">
        <button type="button" className="button" onClick={duplicateSelection}>
          <Copy size={15} aria-hidden="true" /> Duplicar
        </button>
        <button type="button" className="button button--danger" onClick={deleteSelection}>
          <Trash2 size={15} aria-hidden="true" /> Borrar
        </button>
      </div>
      <p className="field__hint">
        ID estable: <code>{node.id}</code>
      </p>
    </>
  );
}

const NEW_STEP = '__new';

/** Which walkthrough step narrates this relation; editing it makes the steps explicit. */
function EdgeStepField({ edge, doc }: { edge: DiagramEdge; doc: DiagramDocument }) {
  const steps = effectiveNarrative(doc);
  const current = steps.find((step) => step.edgeIds.includes(edge.id));
  const options = [
    { value: '', label: 'Fuera del recorrido' },
    ...steps.map((step, index) => ({ value: step.id, label: `${String(index + 1).padStart(2, '0')} · ${step.title}` })),
    { value: NEW_STEP, label: 'Nuevo paso con esta relación' },
  ];
  const onChange = (value: string) => {
    if (value === NEW_STEP) {
      const id = cmd.nextStepId(doc);
      run('Nuevo paso', (d) => cmd.addStep(d, { id, title: edge.label ?? `Paso ${steps.length + 1}`, edgeIds: [edge.id] }));
      return;
    }
    run(value ? 'Mover relación a un paso' : 'Quitar relación del recorrido', (d) => cmd.setEdgeStep(d, edge.id, value || null));
  };
  return (
    <>
      <SelectField label="Paso del recorrido" value={current?.id ?? ''} options={options} onChange={onChange} />
      {current ? (
        <p className="field__hint inspector__step-link">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              useUiStore.getState().setNarrativeStep(current.id);
              useUiStore.getState().setRight(true, 'narrative');
            }}
          >
            Editar el paso en Recorrido
          </button>
        </p>
      ) : null}
    </>
  );
}

function EdgeInspector({ edge, doc }: { edge: DiagramEdge; doc: DiagramDocument }) {
  const label = (id: string) => doc.nodes.find((node) => node.id === id)?.label ?? id;
  return (
    <>
      <p className="inspector__kind">Relación</p>
      <p className="inspector__route">
        <strong>{label(edge.source.nodeId)}</strong> <code>{edge.source.portId}</code> {edge.direction === 'bidirectional' ? '↔' : '→'} <strong>{label(edge.target.nodeId)}</strong> <code>{edge.target.portId}</code>
      </p>
      <SelectField label="Tipo de relación" value={edge.relation} options={RELATION_KINDS.map((relation) => ({ value: relation, label: RELATION_INFO[relation].label }))} onChange={(relation) => run('Cambiar relación', (d) => cmd.updateEdge(d, edge.id, { relation }))} />
      <TextField label="Etiqueta / protocolo" value={edge.label ?? ''} onCommit={(value) => run('Editar etiqueta de relación', (d) => cmd.updateEdge(d, edge.id, { label: value || undefined }))} />
      <SelectField
        label="Dirección"
        value={edge.direction}
        options={EDGE_DIRECTIONS.map((direction) => ({ value: direction, label: direction === 'forward' ? 'Origen → destino' : 'Bidireccional' }))}
        onChange={(direction) => run('Cambiar dirección', (d) => cmd.updateEdge(d, edge.id, { direction }))}
      />
      <EdgeStepField edge={edge} doc={doc} />
      <TextField label="Explicación" value={edge.explanation ?? ''} multiline onCommit={(value) => run('Editar explicación', (d) => cmd.updateEdge(d, edge.id, { explanation: value || undefined }))} />
      <div className="button-row">
        <button type="button" className="button" onClick={() => run('Invertir relación', (d) => cmd.reverseEdge(d, edge.id))}>
          <ArrowLeftRight size={15} aria-hidden="true" /> Invertir
        </button>
        <button type="button" className="button button--danger" onClick={deleteSelection}>
          <Trash2 size={15} aria-hidden="true" /> Borrar
        </button>
      </div>
      <p className="field__hint">Para reconectar, arrastra un extremo de la relación en el editor 2D.</p>
    </>
  );
}

function GroupInspector({ group, doc }: { group: DiagramGroup; doc: DiagramDocument }) {
  const exclude = new Set([group.id, ...cmd.descendantGroups(doc, group.id)]);
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const options = groupOptions(doc, exclude).map((option) => (option.value === '__none__' ? { ...option, label: 'Ninguno (nivel superior)' } : option));
  return (
    <>
      <p className="inspector__kind">Grupo · {GROUP_KIND_LABEL[group.kind]}</p>
      <TextField label="Etiqueta" value={group.label} onCommit={(label) => run('Editar grupo', (d) => cmd.updateGroup(d, group.id, { label }))} />
      <TextField label="Descripción" value={group.description ?? ''} multiline onCommit={(description) => run('Editar grupo', (d) => cmd.updateGroup(d, group.id, { description: description || undefined }))} />
      <SelectField label="Tipo de grupo" value={group.kind} options={GROUP_KINDS.map((kind) => ({ value: kind, label: GROUP_KIND_LABEL[kind] }))} onChange={(kind) => run('Editar grupo', (d) => cmd.updateGroup(d, group.id, { kind }))} />
      <SelectField
        label="Grupo padre"
        value={group.parentGroupId ?? '__none__'}
        options={options}
        hint="Los ciclos de pertenencia se rechazan."
        onChange={(value) => run('Cambiar grupo padre', (d) => cmd.setGroupParent(d, group.id, value === '__none__' ? null : value))}
      />
      <ElementActions type="group" id={group.id} />
      <div className="button-row">
        <button type="button" className="button" aria-pressed={isolated === group.id} onClick={() => useUiStore.getState().isolateGroup(isolated === group.id ? null : group.id)}>
          {isolated === group.id ? 'Mostrar todo en 3D' : 'Aislar en 3D'}
        </button>
        <button type="button" className="button" onClick={ungroupSelection}>
          <Ungroup size={15} aria-hidden="true" /> Desagrupar
        </button>
        <button type="button" className="button button--danger" onClick={deleteSelection}>
          <Trash2 size={15} aria-hidden="true" /> Borrar…
        </button>
      </div>
    </>
  );
}

function DocumentInspector({ doc }: { doc: DiagramDocument }) {
  return (
    <>
      <p className="inspector__kind">Documento</p>
      <TextField label="Nombre" value={doc.name} onCommit={(name) => run('Renombrar diagrama', (d) => cmd.setDocumentInfo(d, { name }))} />
      <TextField label="Descripción" value={doc.description} multiline onCommit={(description) => run('Editar descripción', (d) => cmd.setDocumentInfo(d, { description }))} />
      <dl className="stats">
        <div>
          <dt>Nodos</dt>
          <dd>{doc.nodes.length}</dd>
        </div>
        <div>
          <dt>Relaciones</dt>
          <dd>{doc.edges.length}</dd>
        </div>
        <div>
          <dt>Grupos</dt>
          <dd>{doc.groups.length}</dd>
        </div>
        <div>
          <dt>Esquema</dt>
          <dd>v{doc.schemaVersion}</dd>
        </div>
      </dl>
      <p className="field__hint">Selecciona un elemento en cualquier vista o en «Estructura» para editarlo.</p>
    </>
  );
}

export function Inspector() {
  const doc = useDocumentStore((state) => state.doc);
  const selection = useUiStore((state) => state.selection);
  const primary = useUiStore(selectPrimary);

  if (selection.length > 1) {
    return (
      <div className="panel-section">
        <p className="inspector__kind">{selection.length} elementos seleccionados</p>
        <div className="button-row">
          <button type="button" className="button" onClick={groupSelection}>
            Agrupar
          </button>
          <button type="button" className="button" onClick={duplicateSelection}>
            Duplicar nodos
          </button>
          <button type="button" className="button button--danger" onClick={deleteSelection}>
            Borrar
          </button>
        </div>
      </div>
    );
  }

  const node = primary?.type === 'node' ? doc.nodes.find((candidate) => candidate.id === primary.id) : undefined;
  const edge = primary?.type === 'edge' ? doc.edges.find((candidate) => candidate.id === primary.id) : undefined;
  const group = primary?.type === 'group' ? doc.groups.find((candidate) => candidate.id === primary.id) : undefined;
  return (
    <div className="panel-section" key={primary ? `${primary.type}-${primary.id}` : 'doc'}>
      {node ? <NodeInspector node={node} doc={doc} /> : edge ? <EdgeInspector edge={edge} doc={doc} /> : group ? <GroupInspector group={group} doc={doc} /> : <DocumentInspector doc={doc} />}
    </div>
  );
}
