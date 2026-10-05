/**
 * Optional remote provider behind a backend you control (see
 * docs/generation-contract.md). The browser only knows a URL; API keys stay
 * on the server. The user's text is sent as data and never executed.
 */
import { NODE_KINDS, RELATION_KINDS, SCHEMA_VERSION } from '../../domain/types';
import { graphToDocument } from './generatedGraph';
import { GENERATION_LIMITS, GenerationError, type DiagramGenerator, type GenerationRequest, type GenerationResult } from './types';

export class HttpDiagramGenerator implements DiagramGenerator {
  readonly info;

  constructor(private readonly endpoint: string) {
    this.info = { id: 'remote-http', label: `Proveedor remoto (${new URL(endpoint, window.location.href).host})`, kind: 'remote' as const };
  }

  supports(request: GenerationRequest): boolean {
    return request.mode === 'prompt';
  }

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    if (request.mode !== 'prompt') throw new GenerationError('unsupported', 'El proveedor remoto recibe descripciones en texto.');
    const prompt = request.prompt.trim();
    if (!prompt) throw new GenerationError('limits', 'Describe la arquitectura.');
    if (prompt.length > GENERATION_LIMITS.maxPromptChars) throw new GenerationError('limits', `La descripción supera ${GENERATION_LIMITS.maxPromptChars} caracteres.`);

    const timeout = AbortSignal.timeout(GENERATION_LIMITS.timeoutMs);
    const combined = AbortSignal.any([signal, timeout]);
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          prompt,
          limits: { maxNodes: GENERATION_LIMITS.maxNodes, maxEdges: GENERATION_LIMITS.maxEdges, maxGroups: GENERATION_LIMITS.maxGroups },
          nodeKinds: NODE_KINDS,
          relationKinds: RELATION_KINDS,
        }),
        signal: combined,
      });
    } catch (error) {
      if (signal.aborted) throw new GenerationError('cancelled', 'Generación cancelada.');
      if (timeout.aborted) throw new GenerationError('timeout', 'El proveedor tardó demasiado.');
      throw new GenerationError('network', `No se pudo contactar con el proveedor: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    if (text.length > 1_000_000) throw new GenerationError('limits', 'Respuesta demasiado grande.');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new GenerationError('invalid-output', 'El proveedor no devolvió JSON.');
    }
    if (!response.ok) {
      const message = (body as { error?: { message?: unknown } })?.error?.message;
      throw new GenerationError('http', `El proveedor respondió ${response.status}${typeof message === 'string' ? `: ${message.slice(0, 200)}` : ''}`);
    }
    const graph = (body as { graph?: unknown }).graph;
    const document = graphToDocument(graph, 'porcelain');
    return { document, provider: this.info, notes: ['Salida estructurada validada con Zod e invariantes referenciales.'] };
  }
}

/** A URL is not a secret; keys must never be exposed through VITE_* variables. */
export function configuredRemoteGenerator(): HttpDiagramGenerator | null {
  const endpoint = import.meta.env.VITE_STRATA_GENERATOR_URL as string | undefined;
  return endpoint ? new HttpDiagramGenerator(endpoint) : null;
}
