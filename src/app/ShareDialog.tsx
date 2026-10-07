import { Check, Copy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { create } from 'zustand';
import { Dialog } from '../components/ui/Dialog';
import { CheckboxField } from '../components/ui/fields';
import { encodeDocument, LONG_LINK, shareUrl } from '../features/share/shareLink';
import { useDocumentStore } from '../state/documentStore';

export const useShareDialog = create<{ open: boolean }>()(() => ({ open: false }));

const formatCount = (n: number) => n.toLocaleString('es-ES');

/** Builds a link that carries the whole diagram; nothing is uploaded. */
export function ShareDialog() {
  const open = useShareDialog((state) => state.open);
  const doc = useDocumentStore((state) => state.doc);
  const [present, setPresent] = useState(false);
  const [payload, setPayload] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fieldId = useId();
  const close = () => useShareDialog.setState({ open: false });

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setPayload(null);
    setCopied(false);
    encodeDocument(doc)
      .then((value) => !stale && setPayload(value))
      .catch(() => !stale && setPayload(''));
    return () => {
      stale = true;
    };
  }, [open, doc]);

  const url = payload ? shareUrl(payload, { present }) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard permission the field stays selected for a manual copy.
      document.getElementById(fieldId)?.focus();
    }
  };

  return (
    <Dialog
      open={open}
      title="Compartir enlace"
      onClose={close}
      actions={
        <>
          <button type="button" className="button" onClick={close}>
            Cerrar
          </button>
          <button type="button" className="button button--primary" disabled={!url} onClick={() => void copy()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </>
      }
    >
      <p>
        El diagrama viaja comprimido dentro del enlace, detrás de <code>#</code>: no se sube a ningún servidor. Quien lo abra lo verá en solo lectura y podrá
        presentarlo o guardar una copia.
      </p>
      <div className="field share-link">
        <label htmlFor={fieldId}>Enlace</label>
        <input id={fieldId} readOnly value={payload === null ? 'Generando…' : payload === '' ? 'No se pudo generar el enlace.' : url} onFocus={(event) => event.currentTarget.select()} />
        {url ? (
          <p className="field__hint share-link__meta">
            {formatCount(url.length)} caracteres · {formatCount(doc.nodes.length)} nodos · {formatCount(doc.edges.length)} relaciones
          </p>
        ) : null}
        {url.length > LONG_LINK ? <p className="field__error">Enlace largo: algunas apps de mensajería o correo recortan los enlaces. Si llega roto, comparte el JSON exportado.</p> : null}
      </div>
      <CheckboxField label="Abrir directamente en modo presentación" checked={present} onChange={setPresent} />
      <p className="field__hint">El enlace es una instantánea: los cambios posteriores no se reflejan en él.</p>
    </Dialog>
  );
}
