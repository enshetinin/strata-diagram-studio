import { create } from 'zustand';
import { Dialog } from '../components/ui/Dialog';
import type { ParseResult } from '../domain/parse';

type ParseFailure = Extract<ParseResult, { ok: false }>;

export const useImportErrors = create<{ error: ParseFailure | null }>()(() => ({ error: null }));

/** Explains why an import was rejected; the active document is untouched. */
export function ImportErrorDialog() {
  const error = useImportErrors((state) => state.error);
  const close = () => useImportErrors.setState({ error: null });
  return (
    <Dialog
      open={error !== null}
      title="No se pudo importar el archivo"
      onClose={close}
      actions={
        <button type="button" className="button button--primary" onClick={close}>
          Entendido
        </button>
      }
    >
      <p>{error?.message} El documento actual no se ha modificado.</p>
      {error && error.issues.length > 0 ? (
        <ul className="issue-list">
          {error.issues.slice(0, 12).map((issue, index) => (
            <li key={index}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
          {error.issues.length > 12 ? <li>… y {error.issues.length - 12} problemas más.</li> : null}
        </ul>
      ) : null}
    </Dialog>
  );
}
