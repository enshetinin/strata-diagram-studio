import { setPresentation, type PresentationPatch } from '../../domain/commands';
import { LABEL_MODES, STYLE_IDS, type CameraProjection, type LabelMode } from '../../domain/types';
import { useState } from 'react';
import { newAppearance, setStyle } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { usePreferences, type Quality } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { CheckboxField, RangeField, SelectField } from '../../components/ui/fields';
import { THEMES } from '../../features/viewer3d/themes';
import { SeedInput } from './GeneratePanel';

function update(label: string, patch: PresentationPatch) {
  const result = useDocumentStore.getState().execute(label, (doc) => setPresentation(doc, patch));
  if (!result.ok) useUiStore.getState().notify('error', result.error);
}

/** Random restyle: style, layer height, spacing and layout direction; the graph and its ids stay. */
function AppearanceShuffle() {
  const [seed, setSeed] = useState(3);
  const [relayout, setRelayout] = useState(true);
  return (
    <section className="appearance-shuffle" aria-labelledby="appearance-shuffle">
      <h3 id="appearance-shuffle" className="panel-heading">
        Probar otra apariencia
      </h3>
      <p className="panel-intro">Combina estilo, altura de capas, espaciado y dirección al azar. Conserva componentes, grupos y relaciones.</p>
      <SeedInput label="Seed" value={seed} onChange={setSeed} />
      <CheckboxField label="Reordenar también el diagrama" checked={relayout} onChange={setRelayout} />
      <button type="button" className="button button--block" onClick={() => void newAppearance(seed, relayout)}>
        Aplicar apariencia
      </button>
    </section>
  );
}

const LABEL_MODE_TEXT: Record<LabelMode, string> = { all: 'Todas', auto: 'Automático según densidad', selection: 'Solo selección y grupos' };

export function AppearancePanel() {
  const presentation = useDocumentStore((state) => state.doc.presentation);
  const quality = usePreferences((state) => state.quality);
  const autoDegraded = usePreferences((state) => state.autoDegraded);
  const setQuality = usePreferences((state) => state.setQuality);
  const { appearance } = presentation;

  return (
    <div className="panel-section">
      <fieldset className="style-picker">
        <legend>Estilo</legend>
        <p className="panel-intro">Cambia materiales, geometría, luz, cámara y conectores. Nunca modifica el grafo.</p>
        <div className="style-picker__grid" role="radiogroup" aria-label="Preset de estilo">
          {STYLE_IDS.map((id) => {
            const theme = THEMES[id];
            const active = presentation.styleId === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={active} className={`style-option${active ? ' is-active' : ''}`} onClick={() => setStyle(id)}>
                <span className="style-option__swatch" aria-hidden="true" style={{ background: theme.background }}>
                  <i style={{ background: theme.node.body, borderColor: theme.node.edgeColor }} />
                  <i style={{ background: theme.accents[0] }} />
                  <i style={{ background: theme.connector.colors.default }} />
                </span>
                <span className="style-option__name">{theme.name}</span>
                <span className="style-option__tagline">{theme.tagline}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <AppearanceShuffle />

      <RangeField
        label="Espaciado del auto-layout"
        value={appearance.spacing}
        min={0.6}
        max={1.8}
        step={0.05}
        format={(value) => `×${value.toFixed(2)}`}
        hint="Se aplica al pulsar «Auto-layout»."
        onCommit={(spacing) => update('Cambiar espaciado', { appearance: { spacing } })}
      />
      <RangeField
        label="Altura entre capas (3D)"
        value={appearance.layerHeight}
        min={0}
        max={1.5}
        step={0.05}
        format={(value) => value.toFixed(2)}
        hint="Separación visual de grupos anidados; no cambia la pertenencia."
        onCommit={(layerHeight) => update('Cambiar altura de capas', { appearance: { layerHeight } })}
      />
      <SelectField label="Etiquetas" value={appearance.labelMode} options={LABEL_MODES.map((mode) => ({ value: mode, label: LABEL_MODE_TEXT[mode] }))} onChange={(labelMode) => update('Cambiar etiquetas', { appearance: { labelMode } })} />
      <SelectField
        label="Cámara"
        value={presentation.camera.projection}
        options={[
          { value: 'style', label: `Según estilo (${THEMES[presentation.styleId].camera.projection === 'orthographic' ? 'isométrica' : 'perspectiva'})` },
          { value: 'orthographic', label: 'Isométrica ortográfica' },
          { value: 'perspective', label: 'Perspectiva moderada' },
        ]}
        onChange={(projection: CameraProjection) => update('Cambiar cámara', { camera: { projection } })}
      />
      <CheckboxField
        label="Partículas de flujo ilustrativas"
        checked={appearance.flowParticles}
        hint="Aparecen al seleccionar una relación o en presentación. No representan tráfico real; respetan «reducir movimiento»."
        onChange={(flowParticles) => update('Cambiar partículas', { appearance: { flowParticles } })}
      />
      <SelectField<Quality>
        label="Calidad 3D (este dispositivo)"
        value={quality}
        options={[
          { value: 'low', label: 'Baja · DPR 1, sin sombras' },
          { value: 'medium', label: 'Media · DPR ≤ 1,5, sombras' },
          { value: 'high', label: 'Alta · DPR ≤ 2, sombras' },
        ]}
        hint={autoDegraded ? 'Reducida automáticamente por rendimiento.' : 'Preferencia local; no se guarda en el documento.'}
        onChange={(value) => setQuality(value)}
      />
    </div>
  );
}
