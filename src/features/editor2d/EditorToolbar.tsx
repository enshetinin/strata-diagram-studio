import { useReactFlow } from '@xyflow/react';
import { Copy, Group, Grid3x3, Maximize, Trash2, Ungroup } from 'lucide-react';
import { deleteSelection, duplicateSelection, groupSelection, ungroupSelection } from '../../state/actions';
import { usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { IconButton } from '../../components/ui/IconButton';

export function EditorToolbar() {
  const selection = useUiStore((state) => state.selection);
  const snap = usePreferences((state) => state.snapToGrid);
  const setSnap = usePreferences((state) => state.setSnap);
  const { fitView } = useReactFlow();
  const hasNodes = selection.some((ref) => ref.type === 'node');
  const hasGroup = selection.some((ref) => ref.type === 'group');
  const groupable = selection.some((ref) => ref.type !== 'edge');

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Herramientas de edición 2D">
      <IconButton label="Agrupar selección (Ctrl+G)" icon={Group} onClick={groupSelection} disabled={!groupable} />
      <IconButton label="Desagrupar (Ctrl+Shift+G)" icon={Ungroup} onClick={ungroupSelection} disabled={!hasGroup} />
      <IconButton label="Duplicar (Ctrl+D)" icon={Copy} onClick={duplicateSelection} disabled={!hasNodes} />
      <IconButton label="Borrar selección (Supr)" icon={Trash2} onClick={deleteSelection} disabled={selection.length === 0} />
      <span className="editor-toolbar__sep" aria-hidden="true" />
      <IconButton label={snap ? 'Desactivar ajuste a rejilla' : 'Activar ajuste a rejilla'} icon={Grid3x3} onClick={() => setSnap(!snap)} pressed={snap} />
      <IconButton label="Encuadrar todo" icon={Maximize} onClick={() => void fitView({ padding: 0.15, duration: 250 })} />
    </div>
  );
}
