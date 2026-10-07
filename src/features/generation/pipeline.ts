/**
 * generate → validate (schema + invariants) → layout → preview → confirm → insert.
 * Nothing touches the active document until the user confirms.
 */
import { create } from 'zustand';
import { applyLayout } from '../../domain/commands';
import { parseDocument } from '../../domain/parse';
import { replaceDocument } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { computeAutoLayout } from '../layout/elkLayout';
import { GenerationError, type DiagramGenerator, type GenerationRequest, type GenerationResult } from './types';

interface Pending {
  result: GenerationResult;
  /** Revision of the active document when the request started. */
  startRevision: number;
}

interface GenerationState {
  running: boolean;
  error: GenerationError | null;
  pending: Pending | null;
  controller: AbortController | null;
}

export const useGeneration = create<GenerationState>()(() => ({ running: false, error: null, pending: null, controller: null }));

export async function runGeneration(generator: DiagramGenerator, request: GenerationRequest): Promise<void> {
  useGeneration.getState().controller?.abort();
  const controller = new AbortController();
  const startRevision = useDocumentStore.getState().revision;
  useGeneration.setState({ running: true, error: null, pending: null, controller });
  try {
    const result = await generator.generate(request, controller.signal);
    let document = result.document;
    if (result.provider.kind === 'remote') {
      document = applyLayout(document, await computeAutoLayout(document, { direction: 'RIGHT', spacing: 1 }));
    }
    if (controller.signal.aborted) throw new GenerationError('cancelled', 'Generación cancelada.');
    const checked = parseDocument(document);
    if (!checked.ok) throw new GenerationError('invalid-output', checked.message, checked.issues);
    useGeneration.setState({ pending: { result: { ...result, document: checked.document }, startRevision } });
  } catch (error) {
    const typed = error instanceof GenerationError ? error : new GenerationError('invalid-output', error instanceof Error ? error.message : String(error));
    useGeneration.setState({ error: typed.code === 'cancelled' ? null : typed });
  } finally {
    useGeneration.setState({ running: false, controller: null });
  }
}

export function cancelGeneration(): void {
  useGeneration.getState().controller?.abort();
}

/** True when the user edited the document after the request started. */
export function documentChangedSince(pending: Pending): boolean {
  return useDocumentStore.getState().revision !== pending.startRevision;
}

export function confirmPending(): void {
  const pending = useGeneration.getState().pending;
  if (!pending) return;
  const label = pending.result.provider.kind === 'local' ? 'Nueva arquitectura (reglas locales)' : 'Insertar diagrama generado';
  replaceDocument(pending.result.document, label, 'Diagrama generado.');
  useGeneration.setState({ pending: null });
}

export function discardPending(): void {
  useGeneration.setState({ pending: null });
}
