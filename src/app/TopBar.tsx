import { ChevronDown, Download, Link2, Moon, PanelLeft, PanelRight, Play, Redo2, Sun, Undo2, Workflow } from 'lucide-react';
import { useRef } from 'react';
import { setDocumentInfo } from '../domain/commands';
import { parseDocumentText } from '../domain/parse';
import { autoLayout, replaceDocument } from '../state/actions';
import { selectCanRedo, selectCanUndo, selectRedoLabel, selectUndoLabel, useDocumentStore } from '../state/documentStore';
import { usePreferences } from '../state/preferencesStore';
import { useUiStore } from '../state/uiStore';
import { IconButton } from '../components/ui/IconButton';
import { Menu } from '../components/ui/Menu';
import { StrataMark } from '../components/ui/FluidLines';
import { exportJson, exportSvgFile } from '../features/export/exportActions';
import { blankDocument } from '../features/templates';
import { saveNow, useSaveStatus } from '../features/persistence/autosave';
import { usePngDialog } from './ExportPngDialog';
import { useImportErrors } from './ImportErrorDialog';
import { useShareDialog } from './ShareDialog';

function SaveIndicator() {
  const status = useSaveStatus();
  const text =
    status.state === 'pending'
      ? 'Guardando…'
      : status.state === 'saved'
        ? `Guardado ${status.savedAt ? new Date(status.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
        : status.state === 'error'
          ? 'Error al guardar'
          : 'Sin cambios';
  return (
    <button
      type="button"
      className={`save-indicator save-indicator--${status.state}`}
      title={status.message ?? 'Guardar ahora (Ctrl+S)'}
      onClick={() => saveNow() && useUiStore.getState().notify('success', 'Guardado en este navegador.')}
    >
      <span role="status">{text}</span>
      <span className="visually-hidden"> — Guardar ahora (Ctrl+S)</span>
    </button>
  );
}

function DocumentName() {
  const name = useDocumentStore((state) => state.doc.name);
  const readOnly = useDocumentStore((state) => state.readOnly !== null);
  return (
    <input
      key={name}
      className="topbar__name"
      defaultValue={name}
      readOnly={readOnly}
      aria-label="Nombre del diagrama"
      onBlur={(event) => {
        const value = event.target.value.trim();
        if (value && value !== name) useDocumentStore.getState().execute('Renombrar diagrama', (doc) => setDocumentInfo(doc, { name: value }));
        else event.target.value = name;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

function newBlankDiagram() {
  if (!replaceDocument(blankDocument(), 'Nuevo diagrama', 'Diagrama en blanco creado.')) return;
  // Building starts in 2D, next to the component library.
  const ui = useUiStore.getState();
  ui.setMode('2d');
  ui.setLeft(true, 'library');
}

export function TopBar() {
  const mode = useUiStore((state) => state.mode);
  const setMode = useUiStore((state) => state.setMode);
  const leftOpen = useUiStore((state) => state.leftOpen);
  const rightOpen = useUiStore((state) => state.rightOpen);
  const canUndo = useDocumentStore(selectCanUndo);
  const canRedo = useDocumentStore(selectCanRedo);
  const undoLabel = useDocumentStore(selectUndoLabel);
  const redoLabel = useDocumentStore(selectRedoLabel);
  const fileInput = useRef<HTMLInputElement>(null);
  const theme = usePreferences((state) => state.theme);
  const readOnly = useDocumentStore((state) => state.readOnly !== null);
  const setTheme = usePreferences((state) => state.setTheme);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const result = parseDocumentText(await file.text());
    if (!result.ok) {
      useImportErrors.setState({ error: result });
      return;
    }
    replaceDocument(result.document, 'Importar JSON', `«${result.document.name}» importado.`);
  };

  return (
    <header className="topbar">
      <div className="topbar__identity">
        <IconButton label={leftOpen ? 'Ocultar panel de plantillas' : 'Mostrar panel de plantillas'} icon={PanelLeft} pressed={leftOpen} onClick={() => useUiStore.getState().setLeft(!leftOpen)} />
        <p className="topbar__brand" aria-hidden="true">
          <StrataMark />
          <span className="topbar__brand-word">Strata</span>
        </p>
        <span className="topbar__slash" aria-hidden="true">
          /
        </span>
        <DocumentName />
        {!readOnly ? (
          <Menu
            compact
            label="Documento: nuevo, plantilla, importar"
            icon={<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />}
            items={[
              { label: 'Nuevo diagrama en blanco', hint: 'reemplaza el actual', onSelect: newBlankDiagram },
              { label: 'Abrir plantilla…', hint: 'seis ejemplos', onSelect: () => useUiStore.getState().setLeft(true, 'templates') },
              { label: 'Generar variación…', hint: 'por reglas', onSelect: () => useUiStore.getState().setLeft(true, 'generate') },
              { label: 'Importar JSON…', hint: 'desde un archivo', onSelect: () => fileInput.current?.click() },
            ]}
          />
        ) : null}
      </div>

      <div className="topbar__primary">
        <div className="segmented" role="radiogroup" aria-label="Vista">
          {(['3d', '2d'] as const).map((value) => (
            <button key={value} type="button" role="radio" aria-checked={mode === value} className="segmented__option" onClick={() => setMode(value)}>
              {value === '3d' ? '3D' : readOnly ? '2D' : 'Editar 2D'}
            </button>
          ))}
        </div>

        {!readOnly ? (
          <div className="topbar__group" role="toolbar" aria-label="Documento">
            <IconButton label={undoLabel ? `Deshacer: ${undoLabel} (Ctrl+Z)` : 'Deshacer'} icon={Undo2} onClick={() => useDocumentStore.getState().undo()} disabled={!canUndo} />
            <IconButton label={redoLabel ? `Rehacer: ${redoLabel} (Ctrl+Shift+Z)` : 'Rehacer'} icon={Redo2} onClick={() => useDocumentStore.getState().redo()} disabled={!canRedo} />
            <IconButton label="Auto-layout (ELK)" icon={Workflow} showLabel className="hide-narrow-label" onClick={() => void autoLayout()} />
          </div>
        ) : null}
      </div>

      <div className="topbar__group topbar__group--end">
        {!readOnly ? <SaveIndicator /> : null}
        <IconButton
          label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          icon={theme === 'dark' ? Sun : Moon}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-input"
          onChange={(event) => {
            void onImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Menu
          label="Exportar"
          icon={<Download size={17} strokeWidth={1.75} aria-hidden="true" />}
          items={[
            { label: 'JSON del documento', hint: 'portable, validado', onSelect: exportJson },
            { label: 'SVG de la vista 2D', hint: 'vectorial', onSelect: () => void exportSvgFile() },
            { label: 'Imagen PNG de la escena 3D…', hint: 'título, leyenda, hasta 4K', onSelect: () => usePngDialog.setState({ open: true }) },
          ]}
        />
        <IconButton label="Compartir enlace" icon={Link2} onClick={() => useShareDialog.setState({ open: true })} />
        <button type="button" className="button button--primary button--cta" title="Presentar" onClick={() => useUiStore.getState().setPresenting(true)}>
          <Play className="button__compact-icon" size={17} strokeWidth={1.75} aria-hidden="true" />
          <span className="button__label">Presentar</span>
        </button>
        <IconButton label={rightOpen ? 'Ocultar inspector' : 'Mostrar inspector'} icon={PanelRight} pressed={rightOpen} onClick={() => useUiStore.getState().setRight(!rightOpen)} />
      </div>
    </header>
  );
}
