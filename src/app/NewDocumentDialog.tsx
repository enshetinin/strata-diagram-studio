/**
 * "New diagram" from the document menu: start from a template or generate
 * one. Both replace the current diagram (one is kept per browser), which
 * the dialog says up front; the replace notice offers to undo.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { Dialog } from '../components/ui/Dialog';
import { type TabDef, Tabs } from '../components/ui/Tabs';
import { useGeneration } from '../features/generation/pipeline';
import { GeneratePanel } from './panels/GeneratePanel';
import { TemplatesPanel } from './panels/TemplatesPanel';

type NewTab = 'templates' | 'generate';

export const useNewDocumentDialog = create<{ open: boolean; tab: NewTab }>(() => ({ open: false, tab: 'templates' }));

export const openNewDocument = (tab: NewTab) => useNewDocumentDialog.setState({ open: true, tab });

const TABS: TabDef<NewTab>[] = [
  { id: 'templates', label: 'Plantillas' },
  { id: 'generate', label: 'Generar' },
];

export function NewDocumentDialog() {
  const { open, tab } = useNewDocumentDialog();
  const pending = useGeneration((state) => state.pending);
  const close = () => useNewDocumentDialog.setState({ open: false });

  // A generated result opens its own preview; this dialog steps aside.
  useEffect(() => {
    if (pending) useNewDocumentDialog.setState({ open: false });
  }, [pending]);

  return (
    <Dialog
      open={open}
      wide
      title="Nuevo diagrama"
      onClose={close}
      actions={
        <button type="button" className="button" onClick={close}>
          Cerrar
        </button>
      }
    >
      <p className="field__hint">
        Reemplaza el diagrama actual: solo se guarda uno en este navegador. Puedes deshacerlo justo después.
      </p>
      <Tabs
        idPrefix="new-doc"
        label="Origen del diagrama"
        tabs={TABS}
        active={tab}
        onChange={(next) => useNewDocumentDialog.setState({ tab: next })}
      />
      <div className="new-doc__body" role="tabpanel" id="new-doc-panel" aria-labelledby={`new-doc-tab-${tab}`}>
        {tab === 'templates' ? <TemplatesPanel onOpen={close} /> : <GeneratePanel onHandOff={close} />}
      </div>
    </Dialog>
  );
}
