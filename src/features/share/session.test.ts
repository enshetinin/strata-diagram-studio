import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../../state/documentStore';
import { startAutosave } from '../persistence/autosave';
import { loadSaved } from '../persistence/storage';
import { TEMPLATES } from '../templates';
import { leaveSharedView, openSharedLink } from './session';
import { encodeDocument } from './shareLink';

describe('shared-view session', () => {
  let stopAutosave: () => void;

  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    });
    vi.stubGlobal('window', {
      location: { hash: '', pathname: '/', search: '' },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    useDocumentStore.getState().setReadOnly(null);
    useDocumentStore.getState().load(TEMPLATES[0]!.create());
    stopAutosave = startAutosave();
  });

  afterEach(() => {
    stopAutosave();
    vi.unstubAllGlobals();
    useDocumentStore.getState().setReadOnly(null);
  });

  it('keeps an edit still waiting for autosave when a link opens', async () => {
    const shared = TEMPLATES[1]!.create();
    const payload = await encodeDocument(shared);
    useDocumentStore.getState().execute('Renombrar', (doc) => ({ ...doc, name: 'Mi edición' }));

    expect(await openSharedLink({ payload, present: false })).toBe(true);
    expect(useDocumentStore.getState().doc.name).toBe(shared.name);

    leaveSharedView();
    expect(useDocumentStore.getState().doc.name).toBe('Mi edición');
    const saved = loadSaved();
    expect(saved.status === 'ok' && saved.document.name).toBe('Mi edición');
  });

  it('shows the most recent link when an earlier one decodes later', async () => {
    const [first, second] = [TEMPLATES[1]!.create(), TEMPLATES[2]!.create()];
    const [firstPayload, secondPayload] = await Promise.all([encodeDocument(first), encodeDocument(second)]);

    const results = await Promise.all([
      openSharedLink({ payload: firstPayload, present: false }),
      openSharedLink({ payload: secondPayload, present: false }),
    ]);

    expect(results).toEqual([false, true]);
    expect(useDocumentStore.getState().doc.name).toBe(second.name);
  });
});
