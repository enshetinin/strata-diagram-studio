import { useDocumentStore } from '../../state/documentStore';
import { replaceDocument } from '../../state/actions';
import { TEMPLATES } from '../../features/templates';
import { THEMES } from '../../features/viewer3d/themes';

const DOCUMENT_IDS = new Map(TEMPLATES.map((template) => [template.id, template.create().id]));

export function TemplatesPanel() {
  const currentId = useDocumentStore((state) => state.doc.id);
  return (
    <div className="panel-section">
      <p className="panel-intro">Seis arquitecturas ilustrativas con topología y composición propias. Cargar una plantilla se puede deshacer.</p>
      <ul className="template-list">
        {TEMPLATES.map((template) => {
          const theme = THEMES[template.recommendedStyle];
          const active = currentId === DOCUMENT_IDS.get(template.id);
          return (
            <li key={template.id}>
              <button
                type="button"
                className={`template-card${active ? ' is-active' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => replaceDocument(template.create(), `Cargar plantilla ${template.name}`, `Plantilla «${template.name}» cargada.`)}
              >
                <span className="template-card__swatch" aria-hidden="true" style={{ background: theme.background }}>
                  {theme.accents.slice(0, 3).map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </span>
                <span className="template-card__text">
                  <span className="template-card__name">{template.name}</span>
                  <span className="template-card__summary">{template.summary}</span>
                  <span className="template-card__meta">
                    {template.composition} · estilo {theme.name}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
