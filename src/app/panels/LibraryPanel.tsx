import { Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { KIND_INFO } from '../../domain/catalog';
import { NODE_KINDS } from '../../domain/types';
import { addNodeNearContent } from '../../state/actions';
import { useUiStore } from '../../state/uiStore';
import { LIBRARY_MIME } from '../../features/editor2d/dnd';
import { KIND_GLYPH } from '../../features/editor2d/visual';

export function LibraryPanel() {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const mode = useUiStore((state) => state.mode);
  const kinds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...NODE_KINDS];
    return NODE_KINDS.filter((kind) => `${kind} ${KIND_INFO[kind].label} ${KIND_INFO[kind].summary}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="panel-section">
      <div className="field">
        <label htmlFor={searchId}>Buscar componentes</label>
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="base de datos, cola, agente…" />
      </div>
      <p className="panel-intro">{mode === '2d' ? 'Arrastra al lienzo (sobre un grupo para anidarlo) o pulsa «Añadir».' : 'Pulsa «Añadir»; la posición se ajusta después en 2D.'} Los iconos son genéricos, no logos de proveedores.</p>
      <ul className="library-list">
        {kinds.map((kind) => (
          <li
            key={kind}
            className="library-item"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(LIBRARY_MIME, kind);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d={KIND_GLYPH[kind]} />
            </svg>
            <span className="library-item__text">
              <span className="library-item__name">{KIND_INFO[kind].label}</span>
              <span className="library-item__summary">{KIND_INFO[kind].summary}</span>
            </span>
            <button type="button" className="icon-button" aria-label={`Añadir ${KIND_INFO[kind].label}`} title={`Añadir ${KIND_INFO[kind].label}`} onClick={() => addNodeNearContent(kind)}>
              <Plus size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
        {kinds.length === 0 ? <li className="panel-empty">Ningún componente coincide con «{query}».</li> : null}
      </ul>
    </div>
  );
}
