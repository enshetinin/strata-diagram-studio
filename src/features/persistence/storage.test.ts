import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';
import { loadSaved, STORAGE_KEY, saveDocument } from './storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  quotaBytes = Infinity;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (value.length > this.quotaBytes) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(key, value);
  }
}

describe('local persistence', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('saves and loads a validated document', () => {
    const doc = TEMPLATES[3]!.create();
    expect(saveDocument(doc).ok).toBe(true);
    const loaded = loadSaved();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.document).toEqual(doc);
  });

  it('backs up corrupt data instead of loading it', () => {
    storage.setItem(STORAGE_KEY, '{"document": {"nodes": [');
    const loaded = loadSaved();
    expect(loaded.status).toBe('invalid');
    if (loaded.status === 'invalid') {
      expect(loaded.backupKey).toMatch(/^strata:recovered:/);
      expect(storage.getItem(loaded.backupKey!)).toBe('{"document": {"nodes": [');
    }
  });

  it('refuses unknown schema versions explicitly', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, savedAt: 'x', document: { ...TEMPLATES[0]!.create(), schemaVersion: 2 } }),
    );
    const loaded = loadSaved();
    expect(loaded.status).toBe('invalid');
    if (loaded.status === 'invalid') expect(loaded.message).toContain('no es compatible');
  });

  it('reports quota errors without throwing', () => {
    storage.quotaBytes = 10;
    const result = saveDocument(TEMPLATES[0]!.create());
    expect(result).toMatchObject({ ok: false, reason: 'quota' });
  });
});
