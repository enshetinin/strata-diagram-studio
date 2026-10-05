/**
 * Startup: URL parameters (for sharing / QA), then the autosaved document,
 * then the default template. Invalid saved data is backed up, never parsed
 * half-way.
 */
import { setPresentation } from '../domain/commands';
import { STYLE_IDS, type DiagramDocument, type StyleId } from '../domain/types';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';
import { startAutosave } from '../features/persistence/autosave';
import { loadSaved } from '../features/persistence/storage';
import { defaultDocument, findTemplate, TEMPLATE_CATEGORIES, type TemplateCategory } from '../features/templates';
import { stressDocument } from '../features/templates/stress';
import { generateVariation, type Complexity } from '../features/templates/variations';

function fromUrl(params: URLSearchParams): DiagramDocument | null {
  if (params.get('stress') === '1') return stressDocument();
  const template = params.get('template');
  const variation = params.get('variation');
  if (template) {
    const info = findTemplate(template);
    if (info) return info.create();
  }
  if (variation) {
    const [category, seed, complexity] = variation.split(':');
    if (TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
      return generateVariation({ category: category as TemplateCategory, seed: Number(seed) || 1, complexity: (Math.min(3, Math.max(1, Number(complexity) || 2)) as Complexity) });
    }
  }
  return null;
}

export function bootstrap(): () => void {
  const params = new URLSearchParams(window.location.search);
  const ui = useUiStore.getState();
  let doc = fromUrl(params);

  if (!doc) {
    const saved = loadSaved();
    if (saved.status === 'ok') doc = saved.document;
    else if (saved.status === 'invalid') {
      ui.notify('warning', `${saved.message} Se cargó la plantilla por defecto${saved.backupKey ? `; los datos originales están en localStorage «${saved.backupKey}»` : ''}.`);
    }
  }
  doc ??= defaultDocument();

  const style = params.get('style');
  if (style && STYLE_IDS.includes(style as StyleId)) doc = setPresentation(doc, { styleId: style as StyleId });
  useDocumentStore.getState().load(doc);

  if (params.get('mode') === '2d') ui.setMode('2d');
  if (params.get('panels') === 'closed') {
    ui.setLeft(false);
    ui.setRight(false);
  }
  return startAutosave();
}
