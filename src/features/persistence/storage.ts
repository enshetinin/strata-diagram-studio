/**
 * Local persistence. The document is validated on load; corrupt or
 * incompatible data is preserved under a backup key and never silently
 * replaced by a half-parsed document.
 */
import { parseDocument, serializeDocument } from '../../domain/parse';
import { type DiagramDocument, SCHEMA_VERSION } from '../../domain/types';

export const STORAGE_KEY = 'strata:document';
const BACKUP_PREFIX = 'strata:recovered:';
const REPLACED_PREFIX = 'strata:replaced:';

interface Envelope {
  schemaVersion: number;
  savedAt: string;
  document: unknown;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; document: DiagramDocument; savedAt: string }
  | { status: 'invalid'; message: string; backupKey: string | null };

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function backup(raw: string, prefix = BACKUP_PREFIX): string | null {
  const store = storage();
  if (!store) return null;
  const key = `${prefix}${new Date().toISOString()}`;
  try {
    store.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

export function loadSaved(): LoadResult {
  const store = storage();
  const raw = store?.getItem(STORAGE_KEY);
  if (!raw) return { status: 'empty' };
  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    return { status: 'invalid', message: 'El guardado local estaba dañado (JSON ilegible).', backupKey: backup(raw) };
  }
  const result = parseDocument(envelope?.document);
  if (!result.ok) {
    const detail = result.issues[0] ? ` (${result.issues[0].path}: ${result.issues[0].message})` : '';
    return { status: 'invalid', message: `${result.message}${detail}`, backupKey: backup(raw) };
  }
  return { status: 'ok', document: result.document, savedAt: envelope.savedAt };
}

export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; reason: 'quota' | 'unavailable' | 'unknown'; message: string };

export function saveDocument(doc: DiagramDocument): SaveResult {
  const store = storage();
  if (!store) return { ok: false, reason: 'unavailable', message: 'El almacenamiento local no está disponible.' };
  const savedAt = new Date().toISOString();
  const envelope = `{"schemaVersion":${SCHEMA_VERSION},"savedAt":${JSON.stringify(savedAt)},"document":${serializeDocument(doc)}}`;
  try {
    store.setItem(STORAGE_KEY, envelope);
    return { ok: true, savedAt };
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    return quota
      ? {
          ok: false,
          reason: 'quota',
          message: 'Sin espacio en el almacenamiento local. Exporta el JSON para no perder cambios.',
        }
      : {
          ok: false,
          reason: 'unknown',
          message: `No se pudo guardar: ${error instanceof Error ? error.message : String(error)}`,
        };
  }
}

/**
 * Copies the saved document aside before something replaces it on purpose
 * (keeping a shared diagram). Returns the backup key, or `null` when there
 * was nothing to keep or storage failed.
 */
export function backupSavedDocument(): string | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  return raw ? backup(raw, REPLACED_PREFIX) : null;
}
