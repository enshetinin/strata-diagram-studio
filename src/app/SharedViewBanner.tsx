import { Play } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';
import { serializeDocument } from '../domain/parse';
import { downloadBlob, slugify } from '../features/export/download';
import { loadSaved } from '../features/persistence/storage';
import { keepSharedCopy, leaveSharedView, savedDocumentName, useShareSession } from '../features/share/session';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

function downloadSaved() {
  const saved = loadSaved();
  if (saved.status !== 'ok') return;
  downloadBlob(new Blob([serializeDocument(saved.document)], { type: 'application/json' }), `${slugify(saved.document.name)}.strata.json`);
}

/** Replacing the saved diagram is explicit: name it, offer to download it first. */
function KeepCopyDialog() {
  const saved = useShareSession((state) => state.confirmCopy);
  const shared = useDocumentStore((state) => state.doc.name);
  const close = () => useShareSession.setState({ confirmCopy: null });
  return (
    <Dialog
      open={saved !== null}
      title="Editar una copia"
      onClose={close}
      actions={
        <>
          <button type="button" className="button" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="button button--primary" onClick={keepSharedCopy}>
            Reemplazar y editar
          </button>
        </>
      }
    >
      <p>
        «{shared}» pasará a ser el diagrama guardado en este navegador y sustituirá a «{saved}». Se guarda una copia de seguridad del anterior en el
        almacenamiento local.
      </p>
      <p>
        <button type="button" className="link-button" onClick={downloadSaved}>
          Descargar antes «{saved}» (JSON)
        </button>
      </p>
    </Dialog>
  );
}

/** Thin strip under the header while a shared diagram is open read-only. */
export function SharedViewBanner() {
  const active = useShareSession((state) => state.active);
  const presenting = useUiStore((state) => state.presenting);
  if (!active) return null;

  const editCopy = () => {
    const saved = savedDocumentName();
    if (saved) useShareSession.setState({ confirmCopy: saved });
    else keepSharedCopy();
  };

  return (
    <>
      {!presenting ? (
        <section className="shared-banner" aria-label="Vista compartida">
          <p className="shared-banner__text">
            <span className="eyebrow">Vista compartida</span>
            <span className="shared-banner__note">Solo lectura · tu diagrama guardado no se modifica.</span>
          </p>
          <div className="shared-banner__actions">
            <button type="button" className="button button--small" onClick={() => useUiStore.getState().setPresenting(true)}>
              <Play size={14} aria-hidden="true" />
              Presentar
            </button>
            <button type="button" className="button button--small" onClick={leaveSharedView}>
              Volver a mi diagrama
            </button>
            <button type="button" className="button button--small button--primary" onClick={editCopy}>
              Editar una copia
            </button>
          </div>
        </section>
      ) : null}
      <KeepCopyDialog />
    </>
  );
}
