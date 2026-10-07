import { useEffect, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { confirmPending, discardPending, documentChangedSince, useGeneration } from '../features/generation/pipeline';

/** Preview of a validated generation result; nothing is inserted until confirmed. */
export function GenerationPreviewDialog() {
  const pending = useGeneration((state) => state.pending);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPreview(null);
    if (!pending) return;
    // The SVG renderer (and its routing code) is loaded only when needed.
    void import('../features/export/svg').then(({ documentToSvg }) => {
      if (active)
        setPreview(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(documentToSvg(pending.result.document))}`);
    });
    return () => {
      active = false;
    };
  }, [pending]);
  const doc = pending?.result.document;
  const changed = pending ? documentChangedSince(pending) : false;

  return (
    <Dialog
      open={pending !== null}
      wide
      title="Vista previa"
      onClose={discardPending}
      actions={
        <>
          <button type="button" className="button" onClick={discardPending}>
            Descartar
          </button>
          <button type="button" className="button button--primary" onClick={confirmPending}>
            Insertar y reemplazar
          </button>
        </>
      }
    >
      {doc && pending ? (
        <>
          <p className="preview-meta">
            <strong>{pending.result.provider.label}</strong> · {doc.nodes.length} componentes · {doc.edges.length}{' '}
            relaciones · {doc.groups.length} grupos
          </p>
          {pending.result.notes.map((note) => (
            <p key={note} className="field__hint">
              {note}
            </p>
          ))}
          {changed ? (
            <p className="notice notice--warning" role="alert">
              Editaste el documento mientras se generaba. Si insertas, se reemplazará; tus cambios siguen disponibles
              con «Deshacer».
            </p>
          ) : null}
          {preview ? <img className="preview-image" src={preview} alt={`Vista previa 2D de ${doc.name}`} /> : null}
          <p className="field__hint">Insertar reemplaza el documento actual en una sola entrada de historial.</p>
        </>
      ) : null}
    </Dialog>
  );
}
