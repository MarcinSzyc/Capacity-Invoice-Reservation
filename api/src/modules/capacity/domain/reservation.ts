import {randomUUID} from 'node:crypto';
import {ReleaseExceedsHeldError, ReservationAlreadyReleasedError} from './errors';
import {Money} from './money';
import {Rate} from './rate';

/** Who created the reservation: the client over HTTP, or a reconciliation snapshot (S-06). */
export type ReservationSource = 'client' | 'reconciliation';

/** Derived from what the invoice has left, never stored (glossary, AC-15 amended). */
export type ReservationStatus = 'active' | 'closed';

/** Why a release happened (A-08, glossary). Changes no rule, only what the ledger records. */
export type ReleaseReason = 'repaid' | 'cancelled';

/**
 * A-08: the amount is in invoice currency, and absent means everything left. The release id,
 * the reason and the client belong to the movement, not to the reservation, so they are the
 * use case's to carry: duplicating them here would be two copies with nothing keeping them
 * equal.
 */
export interface ReleaseRequest {
  readonly amount: Money | null;
}

/**
 * What the caller needs to build the movement. `deltaHeld` is signed minor units of the program
 * currency, negative for a release, because `Money` admits no negative amount (ADR-0009).
 */
export interface ReleaseOutcome {
  readonly heldAfter: Money;
  readonly deltaHeld: bigint;
}

export interface ReservationState {
  /** Storage identity, never shown on the API; the public identity is `invoiceId` (A-07). */
  readonly reservationId: string;
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: Money;
  readonly reservedAmount: Money;
  readonly held: Money;
  /** ADR-0009: how much of the invoice has been released, in invoice currency. */
  readonly releasedInvoiceAmount: Money;
  /** A-02: the rate `invoiceAmount` was converted at, fixed for life; every release reuses it. */
  readonly rate: Rate;
  readonly source: ReservationSource;
  readonly clientId: string | null;
  readonly createdAt: Date;
}

export interface OpenReservation {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: Money;
  readonly reservedAmount: Money;
  readonly rate: Rate;
  readonly clientId: string;
  readonly createdAt: Date;
}

/** The reservation in plain words: amounts as minor units, status derived, no internal id. */
export interface ReservationDescription {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: bigint;
  readonly invoiceCurrency: string;
  readonly reservedAmount: bigint;
  readonly held: bigint;
  /** In invoice currency, so a client can see what is left to release (ADR-0009). */
  readonly releasedInvoiceAmount: bigint;
  /** Canonical decimal, the form the API publishes (A-10). */
  readonly rate: string;
  readonly status: ReservationStatus;
  readonly source: ReservationSource;
  readonly createdAt: Date;
}

/**
 * The claim one invoice holds on a program's capacity (glossary). Three amounts: what the
 * client sent, what that took from the limit at creation, and how much of it still occupies the
 * limit, plus the rate the first became the second at (A-02). Same-currency reservations carry
 * a rate of one, so there is one shape rather than two.
 */
export class Reservation {
  private constructor(private state: ReservationState) {}

  static open(request: OpenReservation): Reservation {
    return new Reservation({
      reservationId: randomUUID(),
      programId: request.programId,
      invoiceId: request.invoiceId,
      invoiceAmount: request.invoiceAmount,
      reservedAmount: request.reservedAmount,
      held: request.reservedAmount,
      releasedInvoiceAmount: Money.zero(request.invoiceAmount.currency),
      rate: request.rate,
      source: 'client',
      clientId: request.clientId,
      createdAt: request.createdAt,
    });
  }

  /** For repositories only: a reservation read back from storage. */
  static rehydrate(state: ReservationState): Reservation {
    return new Reservation(state);
  }

  get reservationId(): string {
    return this.state.reservationId;
  }

  get programId(): string {
    return this.state.programId;
  }

  get invoiceId(): string {
    return this.state.invoiceId;
  }

  get invoiceAmount(): Money {
    return this.state.invoiceAmount;
  }

  get reservedAmount(): Money {
    return this.state.reservedAmount;
  }

  get held(): Money {
    return this.state.held;
  }

  get rate(): Rate {
    return this.state.rate;
  }

  get releasedInvoiceAmount(): Money {
    return this.state.releasedInvoiceAmount;
  }

  /** What the invoice still has to give back, in invoice currency. Derived, never stored. */
  get remainingInvoiceAmount(): Money {
    return this.state.invoiceAmount.subtract(this.state.releasedInvoiceAmount);
  }

  /**
   * AC-15, amended 2026-09-24: closed means the whole invoice has been released, not that
   * `held` reached zero. `held` is the remainder converted at the stored rate, so a remainder
   * worth less than half a minor unit of the program currency rounds to zero while the invoice
   * still owes. Such a reservation is active with `held` zero: it occupies none of the limit,
   * and it can still be released to the end.
   */
  get status(): ReservationStatus {
    return this.remainingInvoiceAmount.isZero() ? 'closed' : 'active';
  }

  get source(): ReservationSource {
    return this.state.source;
  }

  get clientId(): string | null {
    return this.state.clientId;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  /**
   * ADR-0009: `held` is derived from what the invoice has left, not decremented per release, so
   * the last instalment closes at exactly zero without a special case. Every `held` is one
   * rounding of one product, so error cannot accumulate across instalments.
   *
   * A reservation with nothing left to release is refused before the amount is judged: it is
   * already released, which is a different answer from asking for more than is left (AC-15
   * against AC-13). The test is the remaining invoice amount, not `held`, so a remainder that
   * rounded away can still be closed.
   */
  release(request: ReleaseRequest): ReleaseOutcome {
    const remaining = this.remainingInvoiceAmount;
    if (remaining.isZero()) throw new ReservationAlreadyReleasedError(this.invoiceId);
    const amount = request.amount ?? remaining;
    if (amount.isGreaterThan(remaining)) {
      throw new ReleaseExceedsHeldError(this.invoiceId, this.held, remaining);
    }

    const heldBefore = this.held;
    const heldAfter = remaining.subtract(amount).convert(this.rate, heldBefore.currency);
    this.state = {
      ...this.state,
      held: heldAfter,
      releasedInvoiceAmount: this.releasedInvoiceAmount.add(amount),
    };
    return {heldAfter, deltaHeld: heldAfter.amount - heldBefore.amount};
  }

  describe(): ReservationDescription {
    return {
      programId: this.programId,
      invoiceId: this.invoiceId,
      invoiceAmount: this.invoiceAmount.amount,
      invoiceCurrency: this.invoiceAmount.currency,
      reservedAmount: this.reservedAmount.amount,
      held: this.held.amount,
      releasedInvoiceAmount: this.releasedInvoiceAmount.amount,
      rate: this.rate.toString(),
      status: this.status,
      source: this.source,
      createdAt: this.createdAt,
    };
  }
}
