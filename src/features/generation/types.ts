import type { DiagramDocument } from '../../domain/types';
import type { ValidationIssue } from '../../domain/invariants';
import type { TemplateCategory } from '../templates';
import type { Complexity } from '../templates/variations';

export type GenerationRequest =
  | { mode: 'rules'; category: TemplateCategory; seed: number; complexity: Complexity }
  | { mode: 'prompt'; prompt: string };

export interface ProviderInfo {
  id: string;
  label: string;
  /** `local` runs deterministic rules in the browser; `remote` calls a backend. */
  kind: 'local' | 'remote';
}

export interface GenerationResult {
  document: DiagramDocument;
  provider: ProviderInfo;
  notes: string[];
}

export type GenerationErrorCode = 'cancelled' | 'unsupported' | 'provider-unavailable' | 'network' | 'http' | 'invalid-output' | 'limits' | 'timeout';

export class GenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

/** Provider-agnostic contract. Implementations must honour `signal`. */
export interface DiagramGenerator {
  readonly info: ProviderInfo;
  supports(request: GenerationRequest): boolean;
  generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult>;
}

export const GENERATION_LIMITS = { maxPromptChars: 2_000, maxNodes: 80, maxEdges: 160, maxGroups: 24, timeoutMs: 60_000 } as const;
