import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, type TabDef } from '../components/ui/Tabs';
import { useUiStore, type LeftTab, type RightTab } from '../state/uiStore';
import { AppearancePanel } from './panels/AppearancePanel';
import { Inspector } from './panels/Inspector';
import { LibraryPanel } from './panels/LibraryPanel';
import { NarrativePanel } from './panels/NarrativePanel';
import { OutlinePanel } from './panels/OutlinePanel';

function Panel({ side, label, children, onClose }: { side: 'left' | 'right'; label: string; children: ReactNode; onClose: () => void }) {
  return (
    <aside className={`side-panel side-panel--${side}`} aria-label={label}>
      <button type="button" className="icon-button side-panel__close" aria-label={`Cerrar ${label.toLowerCase()}`} onClick={onClose}>
        <X size={16} aria-hidden="true" />
      </button>
      {children}
    </aside>
  );
}

/** Left: what the diagram contains. New documents come from the document menu. */
const LEFT_TABS: TabDef<LeftTab>[] = [
  { id: 'outline', label: 'Estructura' },
  { id: 'library', label: 'Biblioteca' },
];

const RIGHT_TABS: TabDef<RightTab>[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'narrative', label: 'Recorrido' },
  { id: 'appearance', label: 'Apariencia' },
];

export function LeftPanel() {
  const tab = useUiStore((state) => state.leftTab);
  const setLeft = useUiStore((state) => state.setLeft);
  return (
    <Panel side="left" label="Estructura y biblioteca" onClose={() => setLeft(false)}>
      <Tabs idPrefix="left" label="Contenido" tabs={LEFT_TABS} active={tab} onChange={(next) => setLeft(true, next)} />
      <div className="side-panel__body" role="tabpanel" id="left-panel" aria-labelledby={`left-tab-${tab}`}>
        {tab === 'library' ? <LibraryPanel /> : <OutlinePanel />}
      </div>
    </Panel>
  );
}

export function RightPanel() {
  const tab = useUiStore((state) => state.rightTab);
  const setRight = useUiStore((state) => state.setRight);
  return (
    <Panel side="right" label="Inspector, recorrido y apariencia" onClose={() => setRight(false)}>
      <Tabs idPrefix="right" label="Propiedades" tabs={RIGHT_TABS} active={tab} onChange={(next) => setRight(true, next)} />
      <div className="side-panel__body" role="tabpanel" id="right-panel" aria-labelledby={`right-tab-${tab}`}>
        {tab === 'inspector' ? <Inspector /> : tab === 'narrative' ? <NarrativePanel /> : <AppearancePanel />}
      </div>
    </Panel>
  );
}
