import { X } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useUiStore, type LeftTab, type RightTab } from '../state/uiStore';
import { AppearancePanel } from './panels/AppearancePanel';
import { GeneratePanel } from './panels/GeneratePanel';
import { Inspector } from './panels/Inspector';
import { LibraryPanel } from './panels/LibraryPanel';
import { OutlinePanel } from './panels/OutlinePanel';
import { TemplatesPanel } from './panels/TemplatesPanel';

interface TabDef<T extends string> {
  id: T;
  label: string;
}

/** WAI-ARIA tabs with arrow-key navigation. */
function Tabs<T extends string>({ idPrefix, tabs, active, onChange, label }: { idPrefix: string; tabs: TabDef<T>[]; active: T; onChange: (tab: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (tab) onChange(tab.id);
    refs.current[next]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={active === tab.id ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

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

const LEFT_TABS: TabDef<LeftTab>[] = [
  { id: 'templates', label: 'Plantillas' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'outline', label: 'Estructura' },
  { id: 'generate', label: 'Generar' },
];

const RIGHT_TABS: TabDef<RightTab>[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'appearance', label: 'Apariencia' },
];

export function LeftPanel() {
  const tab = useUiStore((state) => state.leftTab);
  const setLeft = useUiStore((state) => state.setLeft);
  return (
    <Panel side="left" label="Panel de contenido" onClose={() => setLeft(false)}>
      <Tabs idPrefix="left" label="Contenido" tabs={LEFT_TABS} active={tab} onChange={(next) => setLeft(true, next)} />
      <div className="side-panel__body" role="tabpanel" id="left-panel" aria-labelledby={`left-tab-${tab}`}>
        {tab === 'templates' ? <TemplatesPanel /> : tab === 'library' ? <LibraryPanel /> : tab === 'outline' ? <OutlinePanel /> : <GeneratePanel />}
      </div>
    </Panel>
  );
}

export function RightPanel() {
  const tab = useUiStore((state) => state.rightTab);
  const setRight = useUiStore((state) => state.setRight);
  return (
    <Panel side="right" label="Inspector y apariencia" onClose={() => setRight(false)}>
      <Tabs idPrefix="right" label="Propiedades" tabs={RIGHT_TABS} active={tab} onChange={(next) => setRight(true, next)} />
      <div className="side-panel__body" role="tabpanel" id="right-panel" aria-labelledby={`right-tab-${tab}`}>
        {tab === 'inspector' ? <Inspector /> : <AppearancePanel />}
      </div>
    </Panel>
  );
}
