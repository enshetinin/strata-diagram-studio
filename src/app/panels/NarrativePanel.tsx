/**
 * Walkthrough editor: the ordered steps that "Presentar" narrates. Each step
 * has a title, a caption and the relations it lights up; a step without
 * relations works as an intro or a summary. Reordering renumbers the step
 * markers drawn on the relations in 2D, 3D and SVG.
 */
import { ArrowDown, ArrowUp, GripVertical, Play, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import * as cmd from '../../domain/commands';
import { effectiveNarrative } from '../../domain/narrative';
import type { DiagramDocument, NarrativeStep } from '../../domain/types';
import { addStepFromSelection, presentFrom, previewStep } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { useUiStore } from '../../state/uiStore';
import { IconButton } from '../../components/ui/IconButton';
import { TextField } from '../../components/ui/fields';

const STEP_MIME = 'application/x-strata-step';

function run(label: string, command: (doc: DiagramDocument) => DiagramDocument): boolean {
  const result = useDocumentStore.getState().execute(label, command);
  if (!result.ok) useUiStore.getState().notify('error', result.error);
  return result.ok;
}

const pad = (n: number) => String(n).padStart(2, '0');

function edgeText(doc: DiagramDocument, edgeId: string): string {
  const edge = doc.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return edgeId;
  const label = (id: string) => doc.nodes.find((node) => node.id === id)?.label ?? id;
  return `${label(edge.source.nodeId)} ${edge.direction === 'bidirectional' ? '↔' : '→'} ${label(edge.target.nodeId)}`;
}

function focusStep(id: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-step-id="${CSS.escape(id)}"] .narrative-step__title`)?.focus());
}

function StepDetail({ doc, step, index, count, selectedEdges }: { doc: DiagramDocument; step: NarrativeStep; index: number; count: number; selectedEdges: string[] }) {
  const addable = selectedEdges.filter((id) => !step.edgeIds.includes(id));
  const move = (to: number) => {
    if (run('Reordenar recorrido', (d) => cmd.moveStep(d, step.id, to))) focusStep(step.id);
  };
  return (
    <div className="narrative-step__detail">
      <TextField label="Título" value={step.title} onCommit={(title) => run('Editar paso', (d) => cmd.updateStep(d, step.id, { title }))} />
      <TextField label="Texto" value={step.caption ?? ''} multiline placeholder="Qué ocurre en este paso y por qué importa." onCommit={(caption) => run('Editar paso', (d) => cmd.updateStep(d, step.id, { caption }))} />

      <p className="narrative-step__label">Relaciones</p>
      {step.edgeIds.length > 0 ? (
        <ul className="narrative-step__edges">
          {step.edgeIds.map((edgeId) => (
            <li key={edgeId}>
              <span>{edgeText(doc, edgeId)}</span>
              <IconButton className="icon-button--small" label={`Quitar «${edgeText(doc, edgeId)}» del paso`} icon={X} onClick={() => run('Quitar relación del paso', (d) => cmd.setEdgeStep(d, edgeId, null))} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-empty">Sin relaciones: funciona como introducción o resumen.</p>
      )}
      <button
        type="button"
        className="button button--small"
        disabled={addable.length === 0}
        title={addable.length === 0 ? 'Selecciona relaciones en 2D, 3D o Estructura' : undefined}
        onClick={() => run('Añadir relaciones al paso', (d) => addable.reduce((acc, id) => cmd.setEdgeStep(acc, id, step.id), d))}
      >
        <Plus size={14} aria-hidden="true" />
        {addable.length > 0 ? `Añadir selección (${addable.length})` : 'Añadir selección'}
      </button>

      <div className="narrative-step__actions">
        <IconButton className="icon-button--small" label="Subir paso (Alt+↑)" icon={ArrowUp} disabled={index === 0} onClick={() => move(index - 1)} />
        <IconButton className="icon-button--small" label="Bajar paso (Alt+↓)" icon={ArrowDown} disabled={index === count - 1} onClick={() => move(index + 1)} />
        <IconButton className="icon-button--small" label="Presentar desde este paso" icon={Play} onClick={() => presentFrom(index)} />
        <IconButton
          className="icon-button--small"
          label="Borrar paso"
          icon={Trash2}
          onClick={() => {
            if (run('Borrar paso', (d) => cmd.removeStep(d, step.id))) useUiStore.getState().setNarrativeStep(null);
          }}
        />
      </div>
    </div>
  );
}

export function NarrativePanel() {
  const doc = useDocumentStore((state) => state.doc);
  const openId = useUiStore((state) => state.narrativeStepId);
  const selection = useUiStore((state) => state.selection);
  const steps = useMemo(() => effectiveNarrative(doc), [doc]);
  const selectedEdges = useMemo(() => selection.filter((ref) => ref.type === 'edge').map((ref) => ref.id), [selection]);
  const narrated = useMemo(() => new Set(steps.flatMap((step) => step.edgeIds)).size, [steps]);

  // A step that no longer exists (undo, deletion) closes.
  useEffect(() => {
    if (openId && !steps.some((step) => step.id === openId)) useUiStore.getState().setNarrativeStep(null);
  }, [openId, steps]);

  const [armed, setArmed] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const onDragOver = (event: DragEvent<HTMLLIElement>, id: string) => {
    if (!event.dataTransfer.types.includes(STEP_MIME)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    if (drop?.id !== id || drop.after !== after) setDrop({ id, after });
  };

  const onDrop = (event: DragEvent<HTMLLIElement>) => {
    const source = dragging;
    event.preventDefault();
    setDrop(null);
    if (!source || !drop) return;
    const from = steps.findIndex((step) => step.id === source);
    const target = steps.findIndex((step) => step.id === drop.id);
    // Index in the list once the dragged step is taken out.
    let to = target + (drop.after ? 1 : 0);
    if (from < to) to -= 1;
    if (to !== from) run('Reordenar recorrido', (d) => cmd.moveStep(d, source, to));
  };

  const onTitleKey = (event: KeyboardEvent, step: NarrativeStep, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const to = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= steps.length) return;
    if (run('Reordenar recorrido', (d) => cmd.moveStep(d, step.id, to))) focusStep(step.id);
  };

  return (
    <div className="panel-section narrative">
      <p className="panel-intro">
        {steps.length === 1 ? '1 paso' : `${steps.length} pasos`} · {narrated} {narrated === 1 ? 'relación narrada' : 'relaciones narradas'}. Selecciona relaciones en cualquier vista y crea un paso con ellas; arrastra o usa Alt+↑/↓ para reordenar.
      </p>
      <div className="button-row">
        <button type="button" className="button button--small" onClick={addStepFromSelection}>
          <Plus size={14} aria-hidden="true" />
          {selectedEdges.length > 0 ? `Nuevo paso (${selectedEdges.length})` : 'Nuevo paso'}
        </button>
        <button type="button" className="button button--small button--primary" disabled={steps.length === 0} onClick={() => presentFrom(0)}>
          Presentar
          <span className="button__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="panel-empty">Aún no hay recorrido. Crea el primer paso para explicar el sistema en orden.</p>
      ) : (
        <ol className="narrative__list" aria-label="Pasos del recorrido">
          {steps.map((step, index) => {
            const open = step.id === openId;
            const marker = drop?.id === step.id ? (drop.after ? ' is-drop-after' : ' is-drop-before') : '';
            return (
              <li
                key={step.id}
                data-step-id={step.id}
                className={`narrative-step${open ? ' is-open' : ''}${dragging === step.id ? ' is-dragging' : ''}${marker}`}
                draggable={armed === step.id}
                onDragStart={(event) => {
                  setDragging(step.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(STEP_MIME, step.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setArmed(null);
                  setDrop(null);
                }}
                onDragOver={(event) => onDragOver(event, step.id)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
                }}
                onDrop={onDrop}
              >
                <span className="narrative-step__number" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <div className="narrative-step__main">
                  <button
                    type="button"
                    className="narrative-step__title"
                    aria-expanded={open}
                    aria-label={`Paso ${index + 1}: ${step.title}`}
                    onClick={() => previewStep(open ? null : step.id)}
                    onKeyDown={(event) => onTitleKey(event, step, index)}
                  >
                    {step.title}
                  </button>
                  {!open && step.caption ? <p className="narrative-step__caption">{step.caption}</p> : null}
                  {!open ? <p className="narrative-step__meta">{step.edgeIds.length === 0 ? 'Sin relaciones' : step.edgeIds.length === 1 ? '1 relación' : `${step.edgeIds.length} relaciones`}</p> : null}
                  {open ? <StepDetail doc={doc} step={step} index={index} count={steps.length} selectedEdges={selectedEdges} /> : null}
                </div>
                <span
                  className="narrative-step__grip"
                  title="Arrastrar para reordenar"
                  aria-hidden="true"
                  onPointerDown={() => setArmed(step.id)}
                  onPointerUp={() => setArmed(null)}
                >
                  <GripVertical size={16} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
