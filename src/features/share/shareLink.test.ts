import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';
import { decodeDocument, encodeDocument, readShareHash, shareUrl } from './shareLink';

describe('share links', () => {
  it('round-trips every template through the link payload', async () => {
    for (const template of TEMPLATES) {
      const doc = template.create();
      const payload = await encodeDocument(doc);
      expect(payload).toMatch(/^1\.[A-Za-z0-9_-]+$/);
      const result = await decodeDocument(payload);
      expect(result.ok, template.id).toBe(true);
      if (result.ok) expect(result.document).toEqual(doc);
    }
  });

  it('compresses well below the raw JSON size', async () => {
    const doc = TEMPLATES[0]!.create();
    const payload = await encodeDocument(doc);
    expect(payload.length).toBeLessThan(JSON.stringify(doc).length / 2);
  });

  it('rejects truncated, foreign and future payloads without throwing', async () => {
    const payload = await encodeDocument(TEMPLATES[0]!.create());
    expect((await decodeDocument(payload.slice(0, payload.length / 2))).ok).toBe(false);
    expect((await decodeDocument('1.not-deflate')).ok).toBe(false);
    expect((await decodeDocument(`2.${payload.slice(2)}`)).ok).toBe(false);
    expect((await decodeDocument('')).ok).toBe(false);
  });

  it('reads and builds the fragment', () => {
    expect(readShareHash('#s=1.abc&p=1')).toEqual({ payload: '1.abc', present: true });
    expect(readShareHash('#s=1.abc')).toEqual({ payload: '1.abc', present: false });
    expect(readShareHash('#stage')).toBeNull();
    expect(readShareHash('')).toBeNull();
    expect(shareUrl('1.abc', { present: true }, { origin: 'https://x.dev', pathname: '/app/' })).toBe('https://x.dev/app/#s=1.abc&p=1');
  });
});
