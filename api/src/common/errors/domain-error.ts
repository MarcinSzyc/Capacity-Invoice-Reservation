/**
 * How a domain error should be answered, in words the domain can say without knowing HTTP. The
 * global exception filter turns the kind into a status code, so the mapping lives in one place
 * (CLAUDE.md §2) and no domain class ever imports a framework.
 */
export type DomainErrorKind = 'not_found' | 'conflict' | 'unprocessable';

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
