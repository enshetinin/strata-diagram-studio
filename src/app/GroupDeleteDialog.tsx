import { Dialog } from '../components/ui/Dialog';
import { descendantGroups } from '../domain/commands';
import { confirmGroupDeletion } from '../state/actions';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

/** Deleting a group keeps its content by default; removing content is explicit. */
export function GroupDeleteDialog() {
  const pending = useUiStore((state) => state.pendingGroupDeletion);
  const doc = useDocumentStore((state) => state.doc);
  const close = () => useUiStore.getState().requestGroupDeletion(null);
  const groups = (pending ?? [])
    .map((id) => doc.groups.find((group) => group.id === id))
    .filter((group) => group !== undefined);
  const nested = new Set<string>();
  (pending ?? []).forEach((id) => {
    nested.add(id);
    descendantGroups(doc, id).forEach((child) => nested.add(child));
  });
  const contentCount = doc.nodes.filter((node) => node.groupId && nested.has(node.groupId)).length;
  const names = groups.map((group) => `«${group.label}»`).join(', ');

  return (
    <Dialog
      open={pending !== null}
      title={groups.length === 1 ? `Borrar el grupo ${names}` : `Borrar ${groups.length} grupos`}
      onClose={close}
      actions={
        <>
          <button type="button" className="button" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="button button--danger" onClick={() => confirmGroupDeletion('delete')}>
            Borrar también su contenido ({contentCount} nodos)
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => confirmGroupDeletion('keep')}
            autoFocus
          >
            Borrar solo el grupo
          </button>
        </>
      }
    >
      <p>
        Por defecto, los componentes y subgrupos se conservan en el contenedor superior con su posición actual. Borrar
        el contenido elimina también sus relaciones.
      </p>
    </Dialog>
  );
}
