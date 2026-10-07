import { type ValidationIssue, validateInvariants } from './invariants';
import { documentSchema, LIMITS } from './schema';
import { type DiagramDocument, SCHEMA_VERSION } from './types';

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

/**
 * Brings older documents to the current schema. Only version 1 exists today,
 * so the function only rejects what it cannot interpret. Unknown (newer)
 * versions are never read as the current one.
 */
export function migrateDocument(
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; code: ParseErrorCode; message: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: 'schema', message: 'El contenido no es un documento Strata (se esperaba un objeto).' };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
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
  return { ok: true, value: raw };
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
