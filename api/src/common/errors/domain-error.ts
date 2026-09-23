/**
 * How a domain error should be answered, in words the domain can say without knowing HTTP. The
 * global exception filter turns the kind into a status code, so the mapping lives in one place
 * (CLAUDE.md §2) and no domain class ever imports a framework.
 */
/**
 * `invalid` is a request that is well formed but wrong against state the client could have
 * known, such as a rate that does not match the program's currency (AC-07). The filter answers
 * it like any other validation failure, so a client sees one shape for every `400`.
 */
export type DomainErrorKind = 'not_found' | 'conflict' | 'unprocessable' | 'invalid';

/** The code every validation failure carries, whether a DTO raised it or a use case did. */
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  /** Fields the client needs next to the code, such as `available` on CAPACITY_EXCEEDED. */
  readonly details: Readonly<Record<string, unknown>> = {};

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
