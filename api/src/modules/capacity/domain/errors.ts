import {DomainError, DomainErrorKind} from '../../../common/errors/domain-error';

export const PROGRAM_NOT_FOUND = 'PROGRAM_NOT_FOUND';
export const CURRENCY_MISMATCH = 'CURRENCY_MISMATCH';

export class ProgramNotFoundError extends DomainError {
  readonly code = PROGRAM_NOT_FOUND;
  readonly kind: DomainErrorKind = 'not_found';

  constructor(readonly programId: string) {
    super(`Program ${programId} was never announced by the treasury`);
  }
}

/**
 * INV-08: no arithmetic combines two currencies, and ADR-0007: a treasury message may not
 * re-denominate a program while a reservation still holds an amount in the old currency.
 */
export class CurrencyMismatchError extends DomainError {
  readonly code = CURRENCY_MISMATCH;
  readonly kind: DomainErrorKind = 'unprocessable';

  constructor(
    readonly expected: string,
    readonly actual: string,
    context: string,
  ) {
    super(`${context}: expected ${expected}, got ${actual}`);
  }
}
