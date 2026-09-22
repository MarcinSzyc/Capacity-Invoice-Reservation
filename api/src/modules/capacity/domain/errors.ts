import {DomainError, DomainErrorKind} from '../../../common/errors/domain-error';
import {Money} from './money';
import {Reservation, ReservationDescription} from './reservation';

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

export const CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED';
export const RESERVATION_ALREADY_EXISTS = 'RESERVATION_ALREADY_EXISTS';

/** A-06, A-07: a reservation larger than what is available; the body says how much that is. */
export class CapacityExceededError extends DomainError {
  readonly code = CAPACITY_EXCEEDED;
  readonly kind: DomainErrorKind = 'unprocessable';
  override readonly details: {readonly available: bigint};

  constructor(
    programId: string,
    readonly available: Money,
  ) {
    super(
      `Program ${programId} has ${available.amount} ${available.currency} available in minor units`,
    );
    this.details = {available: available.amount};
  }
}

/** A-07: the pair (program, invoice id) is unique; the body carries the reservation that exists. */
export class ReservationAlreadyExistsError extends DomainError {
  readonly code = RESERVATION_ALREADY_EXISTS;
  readonly kind: DomainErrorKind = 'conflict';
  override readonly details: {readonly reservation: ReservationDescription};

  constructor(readonly existing: Reservation) {
    super(`Invoice ${existing.invoiceId} is already reserved on program ${existing.programId}`);
    this.details = {reservation: existing.describe()};
  }
}
