import { FluidLines } from '../../components/ui/FluidLines';
import { useUiStore } from '../../state/uiStore';

/** Shown instead of the canvas; the document stays intact and editable in 2D. */
export function WebglFallback({ onRetry }: { onRetry: (() => void) | null }) {
  const status = useUiStore((state) => state.webgl);
  const message = useUiStore((state) => state.webglMessage);
  const setMode = useUiStore((state) => state.setMode);
  const setWebgl = useUiStore((state) => state.setWebgl);
  const title =
    status === 'unsupported'
      ? 'WebGL no está disponible'
      : status === 'lost'
        ? 'Se perdió el contexto 3D'
        : 'La vista 3D falló';
  return (
    <div className="viewer-state" role="alert">
      <FluidLines />
      <p className="eyebrow">Vista 3D</p>
      <h2>{title}</h2>
      <p>
        {message ?? 'No se pudo iniciar el renderizador.'} El documento no se ha modificado: puedes seguir trabajando en
        el editor 2D, el inspector y la lista de estructura.
      </p>
      <div className="viewer-state__actions">
        <button type="button" className="button button--primary" onClick={() => setMode('2d')}>
          Continuar en 2D
          <span className="button__arrow" aria-hidden="true">
            →
          </span>
        </button>
        {onRetry ? (
          <button
            type="button"
            className="button"
            onClick={() => {
              setWebgl('unknown');
              onRetry();
            }}
          >
            Reintentar 3D
          </button>
        ) : null}
      </div>
    </div>
  );
}
