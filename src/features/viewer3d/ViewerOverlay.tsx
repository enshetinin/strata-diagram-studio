/**
 * DOM overlays over the canvas: title, legend, primary "Edit in 2D" access,
 * camera actions and the presentation walkthrough. Not part of PNG exports.
 */
import { ChevronLeft, ChevronRight, Crosshair, PencilRuler, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { KIND_INFO, RELATION_INFO } from '../../domain/catalog';
import { effectiveNarrative } from '../../domain/narrative';
import type { NodeKind, RelationKind } from '../../domain/types';
import { useDocumentStore } from '../../state/documentStore';
import { selectPrimary, useUiStore } from '../../state/uiStore';
import { IconButton } from '../../components/ui/IconButton';
import { KIND_GLYPH, RELATION_STROKE } from '../editor2d/visual';
import { THEMES } from './themes';

function Legend({ kinds, relations }: { kinds: NodeKind[]; relations: RelationKind[] }) {
  return (
    <section className="legend" aria-label="Leyenda">
      <h2 className="legend__title">Leyenda</h2>
      <ul className="legend__kinds">
        {kinds.map((kind) => (
          <li key={kind}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d={KIND_GLYPH[kind]} />
            </svg>
            {KIND_INFO[kind].label}
          </li>
        ))}
      </ul>
      <ul className="legend__relations">
        {relations.map((relation) => (
          <li key={relation}>
            <svg viewBox="0 0 28 8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" strokeDasharray={RELATION_STROKE[relation].dash} />
              <path d="M20 1 27 4 20 7Z" />
            </svg>
            {RELATION_INFO[relation].label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Presentation() {
  const doc = useDocumentStore((state) => state.doc);
  const step = useUiStore((state) => state.presentationStep);
  const setStep = useUiStore((state) => state.setPresentationStep);
  const setPresenting = useUiStore((state) => state.setPresenting);
  const steps = useMemo(() => effectiveNarrative(doc), [doc]);
  const current = steps[step];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') setStep(Math.min(steps.length - 1, step + 1));
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') setStep(Math.max(0, step - 1));
      else if (event.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPresenting, setStep, step, steps.length]);

  return (
    <div className="presentation" role="region" aria-label="Recorrido explicado">
      {current ? (
        <div className="presentation__caption" aria-live="polite">
          <p className="presentation__count">
            Paso {step + 1} de {steps.length}
          </p>
          <span className="presentation__progress" aria-hidden="true" style={{ '--progress': steps.length ? (step + 1) / steps.length : 0 } as React.CSSProperties} />
          <h2>{current.title}</h2>
          {current.caption ? <p>{current.caption}</p> : null}
        </div>
      ) : (
        <div className="presentation__caption">
          <h2>Sin recorrido</h2>
          <p>Asigna un orden a las relaciones en el inspector para crear pasos.</p>
        </div>
      )}
      <div className="presentation__controls">
        <IconButton label="Paso anterior (←)" icon={ChevronLeft} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} />
        <IconButton label="Paso siguiente (→)" icon={ChevronRight} onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step >= steps.length - 1} />
        <IconButton label="Salir de presentación (Esc)" icon={X} onClick={() => setPresenting(false)} />
      </div>
    </div>
  );
}

export function ViewerOverlay() {
  const doc = useDocumentStore((state) => state.doc);
  const presenting = useUiStore((state) => state.presenting);
  const primary = useUiStore(selectPrimary);
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const selection = useUiStore((state) => state.selection);
  const theme = THEMES[doc.presentation.styleId];
  const kinds = useMemo(() => [...new Set(doc.nodes.map((node) => node.kind))], [doc.nodes]);
  const relations = useMemo(() => [...new Set(doc.edges.map((edge) => edge.relation))], [doc.edges]);
  const particlesVisible = doc.presentation.appearance.flowParticles && (presenting || selection.some((ref) => ref.type === 'edge'));
  const isolatedLabel = isolated ? doc.groups.find((group) => group.id === isolated)?.label : null;

  const editIn2d = () => {
    const ui = useUiStore.getState();
    ui.setPresenting(false);
    ui.setMode('2d');
    if (primary && primary.type !== 'edge') ui.focus(primary);
  };

  return (
    <div className={`viewer-overlay viewer-overlay--${theme.overlay}`}>
      <header className="scene-title" key={doc.id}>
        <p className="scene-title__style">{theme.name}</p>
        <h1>
          {doc.name}
          <span className="scene-title__cursor" aria-hidden="true">
            _
          </span>
        </h1>
      </header>

      {!presenting ? (
        <div className="viewer-actions">
          <button type="button" className="button button--primary viewer-actions__edit" onClick={editIn2d}>
            <PencilRuler size={17} strokeWidth={1.75} aria-hidden="true" />
            {primary && primary.type !== 'edge' ? 'Editar selección en 2D' : 'Editar en 2D'}
            <span className="button__arrow" aria-hidden="true">
              →
            </span>
          </button>
          <IconButton label="Restablecer cámara" icon={RotateCcw} onClick={() => useUiStore.getState().resetCamera()} />
          <IconButton label="Enfocar selección" icon={Crosshair} onClick={() => primary && primary.type !== 'edge' && useUiStore.getState().focus(primary)} disabled={!primary || primary.type === 'edge'} />
        </div>
      ) : null}

      {isolatedLabel && !presenting ? (
        <p className="viewer-chip">
          Aislado: <strong>{isolatedLabel}</strong>
          <button type="button" className="link-button" onClick={() => useUiStore.getState().isolateGroup(null)}>
            Mostrar todo
          </button>
        </p>
      ) : null}

      {!presenting ? (
        <footer className="scene-colophon">
          {doc.description ? <p className="scene-title__description">{doc.description}</p> : null}
          <Legend kinds={kinds} relations={relations} />
        </footer>
      ) : null}
      {particlesVisible ? <p className="viewer-note">Los puntos en movimiento son ilustrativos: no representan tráfico real.</p> : null}
      {presenting ? <Presentation /> : null}
    </div>
  );
}
