import {
  DomainError,
  DomainErrorKind,
  VALIDATION_FAILED_CODE,
} from '../../../common/errors/domain-error';
import {Money} from './money';
import type {Reservation, ReservationDescription} from './reservation';

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

/**
 * A-02, AC-07: the rate does not fit the two currencies, or the amount it converts to is
 * nothing. The DTO cannot judge either, because neither is knowable without the program's
 * currency, so the use case raises it and the filter renders it as the `400` a client expects.
 */
export class RateValidationError extends DomainError {
  readonly code = VALIDATION_FAILED_CODE;
  readonly kind: DomainErrorKind = 'invalid';
  override readonly details: {readonly details: readonly string[]};

  constructor(
    readonly field: string,
    problem: string,
  ) {
    super(`${field} ${problem}`);
    this.details = {details: [`${field} ${problem}`]};
  }
}

export const RESERVATION_NOT_FOUND = 'RESERVATION_NOT_FOUND';
export const RESERVATION_ALREADY_RELEASED = 'RESERVATION_ALREADY_RELEASED';
export const RELEASE_ALREADY_PROCESSED = 'RELEASE_ALREADY_PROCESSED';
export const RELEASE_EXCEEDS_HELD = 'RELEASE_EXCEEDS_HELD';

/** AC-14: the program may not exist, or it may hold no reservation for that invoice. */
export class ReservationNotFoundError extends DomainError {
  readonly code = RESERVATION_NOT_FOUND;
  readonly kind: DomainErrorKind = 'not_found';

  constructor(
    readonly programId: string,
    readonly invoiceId: string,
  ) {
    super(`Program ${programId} holds no reservation for invoice ${invoiceId}`);
  }
}

/** AC-15: the whole invoice has been released, so there is nothing left to give back. */
export class ReservationAlreadyReleasedError extends DomainError {
  readonly code = RESERVATION_ALREADY_RELEASED;
  readonly kind: DomainErrorKind = 'conflict';

  constructor(readonly invoiceId: string) {
    super(`Reservation ${invoiceId} has nothing left to release: the whole invoice is released`);
  }
}

/**
 * AC-16, A-09: the same `releaseId` twice is the same repayment sent twice. The body carries
 * the outcome the first one had, so a client that retried can see what its release did.
 */
export class ReleaseAlreadyProcessedError extends DomainError {
  readonly code = RELEASE_ALREADY_PROCESSED;
  readonly kind: DomainErrorKind = 'conflict';
  override readonly details: {readonly appliedAt: Date; readonly heldAfter: bigint};

  constructor(
    readonly releaseId: string,
    appliedAt: Date,
    heldAfter: Money,
  ) {
    super(`Release ${releaseId} has already been applied`);
    this.details = {appliedAt, heldAfter: heldAfter.amount};
  }
}

/**
 * AC-13, ADR-0009: judged in invoice currency, against what the invoice has left rather than
 * against `held`, so a release that is legal in invoice terms cannot fail on a rounding
 * boundary. The body says both, because a client thinks in the invoice and the limit moves in
 * the program's currency.
 */
export class ReleaseExceedsHeldError extends DomainError {
  readonly code = RELEASE_EXCEEDS_HELD;
  readonly kind: DomainErrorKind = 'unprocessable';
  override readonly details: {readonly held: bigint; readonly remainingInvoiceAmount: bigint};

  constructor(
    readonly invoiceId: string,
    held: Money,
    remainingInvoiceAmount: Money,
  ) {
    super(
      `Reservation ${invoiceId} has ${remainingInvoiceAmount.amount} ${remainingInvoiceAmount.currency} left to release in minor units`,
    );
    this.details = {held: held.amount, remainingInvoiceAmount: remainingInvoiceAmount.amount};
  }
}
