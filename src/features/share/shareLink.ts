/**
 * Share links without a backend: the document travels compressed inside the
 * URL fragment (`#s=1.<base64url>`). Fragments are never sent to servers, so
 * opening a link uploads nothing. Decoding goes through the same validation
 * as a JSON import.
 */
import { parseDocumentText, type ParseResult } from '../../domain/parse';
import { LIMITS } from '../../domain/schema';
import type { DiagramDocument } from '../../domain/types';

/** Payload format version, so the encoding can change without breaking old links. */
const VERSION = '1';

/** Above this many characters some chats and mail clients cut links. */
export const LONG_LINK = 8_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new RangeError('too-large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Compact JSON → deflate-raw → base64url, prefixed with the format version. */
export async function encodeDocument(doc: DiagramDocument): Promise<string> {
  const compressed = await pipe(new TextEncoder().encode(JSON.stringify(doc)), new CompressionStream('deflate-raw'));
  return `${VERSION}.${toBase64Url(compressed)}`;
}

/** Decodes and validates a payload; anything malformed comes back as a parse failure. */
export async function decodeDocument(payload: string): Promise<ParseResult> {
  const fail = (message: string): ParseResult => ({ ok: false, code: 'schema', message, issues: [] });
  const [version, data] = payload.split('.', 2);
  if (version !== VERSION || !data) return fail('El enlace compartido no tiene un formato reconocible.');
  let text: string;
  try {
    const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'), LIMITS.maxBytes);
    text = new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, code: 'too-large', message: 'El diagrama del enlace supera el tamaño máximo.', issues: [] };
    return fail('El enlace compartido está dañado o incompleto (¿se recortó al copiarlo?).');
  }
  return parseDocumentText(text);
}

export interface ShareHash {
  payload: string;
  present: boolean;
}

/** Reads `#s=<payload>[&p=1]`; `null` for any other fragment. */
export function readShareHash(hash: string): ShareHash | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const payload = params.get('s');
  return payload ? { payload, present: params.get('p') === '1' } : null;
}

export function shareUrl(payload: string, options: { present: boolean }, base: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${base.origin}${base.pathname}#s=${payload}${options.present ? '&p=1' : ''}`;
}
