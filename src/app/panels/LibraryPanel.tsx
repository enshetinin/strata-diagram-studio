import { Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  LIBRARY_CATEGORIES,
  type LibraryCategoryId,
  type LibraryPreset,
  presetSeed,
  searchPresets,
} from '../../domain/library';
import { LIBRARY_MIME } from '../../features/editor2d/dnd';
import { KIND_GLYPH } from '../../features/editor2d/visual';
import { addNodeNearContent } from '../../state/actions';
import { useUiStore } from '../../state/uiStore';

const OPEN_BY_DEFAULT: LibraryCategoryId = 'essentials';

export function LibraryPanel() {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const mode = useUiStore((state) => state.mode);
  const isSearching = query.trim() !== '';
  const sections = useMemo(() => {
    const matches = searchPresets(query);
    return LIBRARY_CATEGORIES.map((category) => ({
      ...category,
      presets: matches.filter((preset) => preset.category === category.id),
    })).filter((section) => section.presets.length > 0);
  }, [query]);
  const total = sections.reduce((sum, section) => sum + section.presets.length, 0);

  return (
    <div className="panel-section">
      <div className="field">
        <label htmlFor={searchId}>Buscar componentes</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="postgres, kafka, agente, cdn…"
        />
      </div>
      <p className="panel-intro">
        {mode === '2d'
          ? 'Arrastra al lienzo (sobre un grupo para anidarlo) o pulsa «Añadir».'
          : 'Pulsa «Añadir»; la posición se ajusta después en 2D.'}{' '}
        Los iconos son genéricos, no logos de proveedores.
      </p>
      {isSearching ? (
        <>
          <p className="library-count" aria-live="polite">
            {total === 1 ? '1 resultado' : `${total} resultados`}
          </p>
          {sections.map((section) => (
            <section key={section.id} className="library-group" aria-label={section.label}>
              <h3 className="library-group__title">
                {section.label}
                <span className="library-group__count">{section.presets.length}</span>
              </h3>
              <PresetList presets={section.presets} />
            </section>
          ))}
          {total === 0 ? <p className="panel-empty">Ningún componente coincide con «{query}».</p> : null}
        </>
      ) : (
        sections.map((section) => (
          <details key={section.id} className="library-group" open={section.id === OPEN_BY_DEFAULT}>
            <summary className="library-group__title">
              {section.label}
              <span className="library-group__count">{section.presets.length}</span>
            </summary>
            <PresetList presets={section.presets} />
          </details>
        ))
      )}
    </div>
  );
}

function PresetList({ presets }: { presets: LibraryPreset[] }) {
  return (
    <ul className="library-list">
      {presets.map((preset) => (
        <li
          key={preset.id}
          className="library-item"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(LIBRARY_MIME, preset.id);
            event.dataTransfer.effectAllowed = 'copy';
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d={KIND_GLYPH[preset.kind]} />
          </svg>
          <span className="library-item__text">
            <span className="library-item__name">{preset.label}</span>
            <span className="library-item__summary">
              {preset.provider ? <span className="library-item__provider">{preset.provider}</span> : null}
              {preset.summary}
            </span>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Añadir ${preset.label}`}
            title={`Añadir ${preset.label}`}
            onClick={() => addNodeNearContent(presetSeed(preset))}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
