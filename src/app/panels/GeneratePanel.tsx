/**
 * Two separate actions, clearly labelled:
 *  - "Nueva arquitectura" changes topology (local rules, or a remote provider).
 *  - "Nueva apariencia" changes style/layout and keeps the graph.
 */
import { Dices, Loader2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { newAppearance, replaceDocument } from '../../state/actions';
import { CheckboxField, SelectField } from '../../components/ui/fields';
import { LocalRuleGenerator } from '../../features/generation/localGenerator';
import { cancelGeneration, runGeneration, useGeneration } from '../../features/generation/pipeline';
import { configuredRemoteGenerator } from '../../features/generation/remoteGenerator';
import { suggestTemplates } from '../../features/generation/suggest';
import { GENERATION_LIMITS } from '../../features/generation/types';
import { TEMPLATES, type TemplateCategory } from '../../features/templates';
import type { Complexity } from '../../features/templates/variations';
import { normalizeSeed } from '../../features/templates/random';

const local = new LocalRuleGenerator();

/** A fresh seed comes from a user click, never from rendering. */
function freshSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 1) % 100_000;
}

function SeedInput({ value, onChange, label }: { value: number; onChange: (seed: number) => void; label: string }) {
  const id = useId();
  return (
    <div className="field field--inline">
      <label htmlFor={id}>{label}</label>
      <input id={id} inputMode="numeric" value={value} onChange={(event) => onChange(normalizeSeed(event.target.value.replace(/\D/g, '') || '0'))} />
      <button type="button" className="icon-button" aria-label="Nueva seed" title="Nueva seed" onClick={() => onChange(freshSeed())}>
        <Dices size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function GeneratePanel() {
  const [category, setCategory] = useState<TemplateCategory>('rag');
  const [complexity, setComplexity] = useState<Complexity>(2);
  const [seed, setSeed] = useState(7);
  const [lookSeed, setLookSeed] = useState(3);
  const [relayout, setRelayout] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const promptId = useId();
  const running = useGeneration((state) => state.running);
  const error = useGeneration((state) => state.error);
  const remote = useMemo(() => configuredRemoteGenerator(), []);
  const suggestions = useMemo(() => (submitted !== null ? suggestTemplates(submitted) : []), [submitted]);

  return (
    <div className="panel-section">
      <section aria-labelledby="gen-arch">
        <h3 id="gen-arch" className="panel-heading">
          Nueva arquitectura
        </h3>
        <p className="panel-intro">
          <strong>Generador local basado en reglas.</strong> Cambia la topología según categoría, complejidad y seed. No interpreta lenguaje natural; la misma seed produce el mismo diagrama.
        </p>
        <SelectField label="Categoría" value={category} onChange={setCategory} options={TEMPLATES.map((template) => ({ value: template.category, label: template.name }))} />
        <SelectField
          label="Complejidad"
          value={String(complexity) as '1' | '2' | '3'}
          onChange={(value) => setComplexity(Number(value) as Complexity)}
          options={[
            { value: '1', label: '1 · compacta' },
            { value: '2', label: '2 · media' },
            { value: '3', label: '3 · amplia' },
          ]}
        />
        <SeedInput label="Seed" value={seed} onChange={setSeed} />
        <button type="button" className="button button--primary button--block" disabled={running} onClick={() => void runGeneration(local, { mode: 'rules', category, seed, complexity })}>
          Generar vista previa
          <span className="button__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </section>

      <section aria-labelledby="gen-look">
        <h3 id="gen-look" className="panel-heading">
          Nueva apariencia
        </h3>
        <p className="panel-intro">Cambia estilo, altura de capas, espaciado y dirección del layout. Conserva nodos, grupos, relaciones e IDs.</p>
        <SeedInput label="Seed" value={lookSeed} onChange={setLookSeed} />
        <CheckboxField label="Recalcular layout con ELK" checked={relayout} onChange={setRelayout} />
        <button type="button" className="button button--block" onClick={() => void newAppearance(lookSeed, relayout)}>
          Aplicar nueva apariencia
        </button>
      </section>

      <section aria-labelledby="gen-prompt">
        <h3 id="gen-prompt" className="panel-heading">
          Describir una arquitectura
        </h3>
        <div className="field">
          <label htmlFor={promptId}>Descripción</label>
          <textarea id={promptId} rows={4} maxLength={GENERATION_LIMITS.maxPromptChars} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="p. ej. pipeline de eventos con Kafka, pagos e inventario" />
        </div>
        {remote ? (
          <>
            <p className="panel-intro">
              Proveedor configurado: <strong>{remote.info.label}</strong>. La respuesta se valida y se muestra antes de insertarla.
            </p>
            <div className="button-row">
              <button type="button" className="button button--primary" disabled={running || !prompt.trim()} onClick={() => void runGeneration(remote, { mode: 'prompt', prompt })}>
                {running ? <Loader2 className="spin" size={16} aria-hidden="true" /> : null}
                Generar con proveedor
              </button>
              {running ? (
                <button type="button" className="button" onClick={cancelGeneration}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="panel-intro">
              La generación libre a partir de texto requiere conectar un proveedor (variable <code>VITE_STRATA_GENERATOR_URL</code> apuntando a tu backend; ver <code>docs/generation-contract.md</code>). Sin él, solo buscamos <em>palabras clave</em> para sugerir ejemplos compatibles.
            </p>
            <button type="button" className="button button--block" disabled={!prompt.trim()} onClick={() => setSubmitted(prompt)}>
              Buscar ejemplos compatibles
            </button>
            {submitted !== null ? (
              suggestions.length > 0 ? (
                <ul className="suggestion-list" aria-label="Ejemplos compatibles">
                  {suggestions.map((template) => (
                    <li key={template.id}>
                      <span>{template.name}</span>
                      <button type="button" className="link-button" onClick={() => replaceDocument(template.create(), `Cargar plantilla ${template.name}`)}>
                        Abrir plantilla
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setCategory(template.category);
                          void runGeneration(local, { mode: 'rules', category: template.category, seed, complexity });
                        }}
                      >
                        Variación local
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-empty">Ninguna plantilla coincide con esas palabras clave.</p>
              )
            ) : null}
          </>
        )}
        {error ? (
          <div className="notice notice--error" role="alert">
            <p>{error.message}</p>
            {error.issues.length > 0 ? (
              <ul className="issue-list">
                {error.issues.slice(0, 6).map((issue, index) => (
                  <li key={index}>
                    <code>{issue.path}</code> {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
