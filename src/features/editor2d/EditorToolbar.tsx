import { useReactFlow } from '@xyflow/react';
import { CircleHelp, Copy, Group, Grid3x3, Maximize, Plus, Trash2, Ungroup } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { KIND_INFO } from '../../domain/catalog';
import { deepestGroupAt, resolveAbsoluteLayout } from '../../domain/geometry';
import { DEFAULT_NODE_SIZE, NODE_KINDS, type NodeKind } from '../../domain/types';
import { addNodeAt, deleteSelection, duplicateSelection, groupSelection, ungroupSelection } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { IconButton } from '../../components/ui/IconButton';
import { Menu } from '../../components/ui/Menu';
import { KIND_GLYPH } from './visual';

const HELP: [string, string][] = [
  ['Añadir', 'Botón «Añadir» o arrastra desde Biblioteca (sobre un grupo para meterlo dentro).'],
  ['Conectar', 'Pasa el ratón por un componente y arrastra desde uno de sus puntos hasta otro componente.'],
  ['Seleccionar', 'Clic; Mayús + clic o arrastrar sobre el vacío para varios. Los grupos, por su etiqueta.'],
  ['Moverse', 'Espacio + arrastrar, botón central o scroll del trackpad.'],
  ['Zoom', 'Pellizco o Ctrl/⌘ + rueda.'],
  ['Agrupar', 'Selecciona varios y pulsa Ctrl/⌘ + G.'],
];

/** Gesture cheat sheet: the canvas hides most of them (handles only show on hover). */
function CanvasHelp() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="editor-help" ref={root}>
      <ToolButton label="Cómo se usa el lienzo" icon={CircleHelp} aria-expanded={open} aria-controls="editor-help" onClick={() => setOpen(!open)} />
      {open ? (
        <dl className="editor-help__panel" id="editor-help">
          {HELP.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Toolbar button with an immediate tooltip (CSS, from aria-label) instead of the slow native one. */
function ToolButton({ className = '', ...props }: React.ComponentProps<typeof IconButton>) {
  return <IconButton {...props} title="" className={`editor-toolbar__tool ${className}`} />;
}

export function EditorToolbar() {
  const selection = useUiStore((state) => state.selection);
  const snap = usePreferences((state) => state.snapToGrid);
  const setSnap = usePreferences((state) => state.setSnap);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const hasNodes = selection.some((ref) => ref.type === 'node');
  const hasGroup = selection.some((ref) => ref.type === 'group');
  const groupable = selection.some((ref) => ref.type !== 'edge');
  // Shared links are read-only: keep only the view tools.
  const readOnly = useDocumentStore((state) => state.readOnly !== null);

  /** New components land in the middle of what is on screen, inside the group there. */
  const addAtCentre = (kind: NodeKind) => {
    const pane = document.querySelector('.editor2d .react-flow')?.getBoundingClientRect();
    if (!pane) return;
    const centre = screenToFlowPosition({
      x: pane.left + pane.width / 2,
      y: pane.top + pane.height / 2,
    });
    const layout = resolveAbsoluteLayout(useDocumentStore.getState().doc);
    // Step right past any component already there, so new ones never overlap.
    const position = {
      x: centre.x - DEFAULT_NODE_SIZE.width / 2,
      y: centre.y - DEFAULT_NODE_SIZE.height / 2,
    };
    const gap = 48;
    const blocking = () =>
      [...layout.nodes.values()].find(
        (rect) => position.x < rect.x + rect.width + gap && rect.x < position.x + DEFAULT_NODE_SIZE.width + gap && position.y < rect.y + rect.height + gap && rect.y < position.y + DEFAULT_NODE_SIZE.height + gap,
      );
    for (let rect = blocking(); rect; rect = blocking()) position.x = rect.x + rect.width + gap;
    addNodeAt(kind, position, deepestGroupAt(layout, centre));
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Herramientas de edición 2D">
      {!readOnly ? (
        <>
          <Menu
            label="Añadir"
            align="start"
            className="editor-toolbar__add"
            icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
            items={NODE_KINDS.map((kind) => ({
              label: KIND_INFO[kind].label,
              icon: (
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d={KIND_GLYPH[kind]} />
                </svg>
              ),
              onSelect: () => addAtCentre(kind),
            }))}
          />
          <span className="editor-toolbar__sep" aria-hidden="true" />
          <ToolButton label="Agrupar selección (Ctrl+G)" icon={Group} onClick={groupSelection} disabled={!groupable} />
          <ToolButton label="Desagrupar (Ctrl+Shift+G)" icon={Ungroup} onClick={ungroupSelection} disabled={!hasGroup} />
          <ToolButton label="Duplicar (Ctrl+D)" icon={Copy} onClick={duplicateSelection} disabled={!hasNodes} />
          <ToolButton label="Borrar selección (Supr)" icon={Trash2} onClick={deleteSelection} disabled={selection.length === 0} />
          <span className="editor-toolbar__sep" aria-hidden="true" />
        </>
      ) : null}
      {/* Secondary on phones: framing is also in the zoom controls. */}
      <ToolButton label={snap ? 'Desactivar ajuste a rejilla' : 'Activar ajuste a rejilla'} icon={Grid3x3} onClick={() => setSnap(!snap)} pressed={snap} className="editor-toolbar__wide" />
      <ToolButton label="Encuadrar todo" icon={Maximize} onClick={() => void fitView({ padding: 0.15, duration: 250 })} className="editor-toolbar__wide" />
      <span className="editor-toolbar__sep editor-toolbar__wide" aria-hidden="true" />
      <CanvasHelp />
    </div>
  );
}
