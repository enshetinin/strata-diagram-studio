import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Dialog } from '../components/ui/Dialog';
import { CheckboxField } from '../components/ui/fields';
import { exportPngFile, renderPng } from '../features/export/exportActions';
import { PNG_FORMAT_IDS, PNG_FORMATS } from '../features/export/pngOptions';
import { useDocumentStore } from '../state/documentStore';
import { usePreferences } from '../state/preferencesStore';

export const usePngDialog = create<{ open: boolean }>()(() => ({ open: false }));

/** Longest side of the live preview, in pixels. */
const PREVIEW = 720;

/** Live preview of the composed image, re-rendered (debounced) when options or the document change. */
function Preview() {
  const options = usePreferences((state) => state.png);
  const revision = useDocumentStore((state) => state.revision);
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const format = PNG_FORMATS[options.format];

  useEffect(() => {
    let stale = false;
    const { width, height } = PNG_FORMATS[options.format];
    const k = PREVIEW / Math.max(width, height);
    const timer = setTimeout(() => {
      setState('loading');
      renderPng(options, { width: Math.round(width * k), height: Math.round(height * k) })
        .then((image) => {
          const canvas = ref.current;
          if (stale || !canvas) return;
          canvas.width = image.width;
          canvas.height = image.height;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          setState('ready');
        })
        .catch(() => !stale && setState('error'));
    }, 120);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [options, revision]);

  return (
    <figure className={`png-export__preview${options.transparent ? ' is-transparent' : ''}`} data-state={state}>
      <canvas ref={ref} style={{ aspectRatio: `${format.width} / ${format.height}` }} aria-label="Vista previa de la imagen" role="img" />
      <figcaption>
        <span>
          {format.width} × {format.height} px
        </span>
        <span aria-live="polite">{state === 'loading' ? 'Generando vista previa…' : state === 'error' ? 'No se pudo generar la vista previa.' : 'Vista previa'}</span>
      </figcaption>
    </figure>
  );
}

export function ExportPngDialog() {
  const open = usePngDialog((state) => state.open);
  const options = usePreferences((state) => state.png);
  const setPng = usePreferences((state) => state.setPng);
  const [busy, setBusy] = useState(false);
  const close = () => usePngDialog.setState({ open: false });

  const submit = async () => {
    setBusy(true);
    const ok = await exportPngFile(options);
    setBusy(false);
    if (ok) close();
  };

  return (
    <Dialog
      open={open}
      wide
      title="Exportar imagen"
      onClose={close}
      actions={
        <>
          <button type="button" className="button" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="button button--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Exportando…' : 'Exportar PNG'}
          </button>
        </>
      }
    >
      <div className="png-export">
        <Preview />
        <div className="png-export__options">
          <fieldset className="png-export__formats">
            <legend className="panel-heading">Formato</legend>
            {PNG_FORMAT_IDS.map((id) => (
              <label key={id} className="png-export__format">
                <input type="radio" name="png-format" value={id} checked={options.format === id} onChange={() => setPng({ format: id })} />
                <span>{PNG_FORMATS[id].label}</span>
                <code>
                  {PNG_FORMATS[id].width}×{PNG_FORMATS[id].height}
                </code>
              </label>
            ))}
          </fieldset>
          <fieldset className="png-export__include">
            <legend className="panel-heading">Incluir</legend>
            <CheckboxField label="Título y descripción" checked={options.title} onChange={(title) => setPng({ title })} />
            <CheckboxField label="Leyenda" checked={options.legend} onChange={(legend) => setPng({ legend })} />
            <CheckboxField label="Fondo transparente" checked={options.transparent} onChange={(transparent) => setPng({ transparent })} />
          </fieldset>
        </div>
      </div>
    </Dialog>
  );
}
