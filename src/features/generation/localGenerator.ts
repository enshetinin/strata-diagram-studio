import { parseDocument } from '../../domain/parse';
import { generateVariation } from '../templates/variations';
import { type DiagramGenerator, GenerationError, type GenerationRequest, type GenerationResult } from './types';

/**
 * Deterministic rule-based generator. It changes topology by seed, category
 * and complexity. It does not interpret free text and says so.
 */
export class LocalRuleGenerator implements DiagramGenerator {
  readonly info = { id: 'local-rules', label: 'Generador local por reglas', kind: 'local' as const };

  supports(request: GenerationRequest): boolean {
    return request.mode === 'rules';
  }

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    if (signal.aborted) throw new GenerationError('cancelled', 'Generación cancelada.');
    if (request.mode !== 'rules') {
      throw new GenerationError(
        'unsupported',
        'El generador local no interpreta texto libre; elige una categoría y una seed.',
      );
    }
    const document = generateVariation(request);
    const checked = parseDocument(document);
    if (!checked.ok) throw new GenerationError('invalid-output', checked.message, checked.issues);
    return {
      document: checked.document,
      provider: this.info,
      notes: [
        `Reglas de «${request.category}», seed ${request.seed}, complejidad ${request.complexity}. Mismo input → mismo diagrama.`,
      ],
    };
  }
}
