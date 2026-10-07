import { type ValidationIssue, validateInvariants } from './invariants';
import { documentSchema, LIMITS } from './schema';
import { type DiagramDocument, LEGACY_STYLES, type LegacyStyleId, SCHEMA_VERSION } from './types';

export type ParseErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'unknown-version'
  | 'missing-version'
  | 'schema'
  | 'invariants';

export type ParseResult =
  | { ok: true; document: DiagramDocument }
  | { ok: false; code: ParseErrorCode; message: string; issues: ValidationIssue[] };

function fail(code: ParseErrorCode, message: string, issues: ValidationIssue[] = []): ParseResult {
  return { ok: false, code, message, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLegacyStyleId(value: unknown): value is LegacyStyleId {
  return typeof value === 'string' && Object.hasOwn(LEGACY_STYLES, value);
}

/**
 * Rewrites a retired style preset (Glass, Monochrome, Orbit) to its
 * successor and the appearance options that keep its look. Anything that is
 * not a legacy preset passes through untouched for the schema to judge.
 */
function upgradeLegacyStyle(doc: Record<string, unknown>): Record<string, unknown> {
  const presentation = doc.presentation;
  if (!isRecord(presentation) || !isLegacyStyleId(presentation.styleId)) return doc;
  const legacy: (typeof LEGACY_STYLES)[LegacyStyleId] = LEGACY_STYLES[presentation.styleId];
  const camera = isRecord(presentation.camera) ? presentation.camera : {};
  const appearance = isRecord(presentation.appearance) ? presentation.appearance : {};
  const styleProjection = 'styleProjection' in legacy ? legacy.styleProjection : undefined;
  return {
    ...doc,
    presentation: {
      ...presentation,
      styleId: legacy.styleId,
      camera: styleProjection && camera.projection === 'style' ? { ...camera, projection: styleProjection } : camera,
      appearance: { ...appearance, ...legacy.appearance },
    },
  };
}

/**
 * Brings older documents to the current schema. Only version 1 exists today,
 * so the function only rejects what it cannot interpret and upgrades retired
 * style presets. Unknown (newer) versions are never read as the current one.
 */
export function migrateDocument(
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; code: ParseErrorCode; message: string } {
  if (!isRecord(raw)) {
    return { ok: false, code: 'schema', message: 'El contenido no es un documento Strata (se esperaba un objeto).' };
  }
  const version = raw.schemaVersion;
  if (version === undefined) {
    return { ok: false, code: 'missing-version', message: 'El documento no declara schemaVersion.' };
  }
  if (version !== SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'unknown-version',
      message: `schemaVersion ${JSON.stringify(version)} no es compatible: esta versión de la aplicación lee la ${SCHEMA_VERSION}.`,
    };
  }
  return { ok: true, value: upgradeLegacyStyle(raw) };
}

/** Full pipeline for untrusted input: migrate → schema → referential invariants. */
export function parseDocument(raw: unknown): ParseResult {
  const migrated = migrateDocument(raw);
  if (!migrated.ok) return fail(migrated.code, migrated.message);

  const parsed = documentSchema.safeParse(migrated.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 50).map((issue) => ({
      path: issue.path.map(String).join('.') || '(raíz)',
      message: issue.message,
    }));
    return fail('schema', 'El documento no cumple el esquema.', issues);
  }

  const issues = validateInvariants(parsed.data);
  if (issues.length > 0) return fail('invariants', 'El documento tiene referencias inválidas.', issues);
  return { ok: true, document: parsed.data };
}

/** Parses JSON text with a size limit before touching the structure. */
export function parseDocumentText(text: string): ParseResult {
  if (text.length > LIMITS.maxBytes) {
    return fail('too-large', `El archivo supera el límite de ${Math.round(LIMITS.maxBytes / 1_000_000)} MB.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail('invalid-json', `JSON no válido: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseDocument(raw);
}

export function serializeDocument(doc: DiagramDocument): string {
  return JSON.stringify(doc, null, 2);
}
