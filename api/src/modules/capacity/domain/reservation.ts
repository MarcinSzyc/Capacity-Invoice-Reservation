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
  /**
   * ADR-0012, 1A: signed minor units of the program currency that a snapshot set so `held` equals
   * the treasury's figure. Zero until a snapshot corrects the reservation; kept through releases.
   */
  readonly heldCorrection: bigint;
  readonly source: ReservationSource;
  readonly clientId: string | null;
  readonly createdAt: Date;
}

/** ADR-0011: all a snapshot tells us about an invoice we did not know. */
export interface SnapshotReservation {
  readonly programId: string;
  readonly invoiceId: string;
  /** In program currency; must hold something, since a reservation holding nothing is closed. */
  readonly held: Money;
  readonly asOf: Date;
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
      heldCorrection: 0n,
      source: 'client',
      clientId: request.clientId,
      createdAt: request.createdAt,
    });
  }

  /**
   * ADR-0011: the treasury tells us a held amount in program currency and nothing about the
   * invoice, so that amount is the invoice, at rate one. `createdAt` is the snapshot's moment,
   * when the treasury knew it, so a later snapshot judges it on the treasury's clock alone.
   */
  static fromSnapshot(request: SnapshotReservation): Reservation {
    if (request.held.isZero()) {
      throw new RangeError(`Reservation ${request.invoiceId} from a snapshot would hold nothing`);
    }
    return new Reservation({
      reservationId: randomUUID(),
      programId: request.programId,
      invoiceId: request.invoiceId,
      invoiceAmount: request.held,
      reservedAmount: request.held,
      held: request.held,
      releasedInvoiceAmount: Money.zero(request.held.currency),
      rate: Rate.one(),
      heldCorrection: 0n,
      source: 'reconciliation',
      clientId: null,
      createdAt: request.asOf,
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

  get heldCorrection(): bigint {
    return this.state.heldCorrection;
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
    const heldAfter = this.heldFor(remaining.subtract(amount));
    this.state = {
      ...this.state,
      held: heldAfter,
      releasedInvoiceAmount: this.releasedInvoiceAmount.add(amount),
    };
    return {heldAfter, deltaHeld: heldAfter.amount - heldBefore.amount};
  }

  /**
   * ADR-0012, 1A: a snapshot's figure for an active reservation. The correction is set, never
   * added to, so `held` is exactly the target and the same snapshot twice moves nothing. Returns
   * the signed change of `held`, for the adjustment row.
   */
  correctTo(target: Money): bigint {
    if (this.status === 'closed') {
      throw new RangeError(
        `Reservation ${this.invoiceId} is closed; a snapshot reopens it instead`,
      );
    }
    const heldBefore = this.held;
    const converted = this.remainingInvoiceAmount.convert(this.rate, heldBefore.currency);
    this.state = {...this.state, held: target, heldCorrection: target.amount - converted.amount};
    return target.amount - heldBefore.amount;
  }

  /**
   * AC-27: the treasury says the reservation was gone at its moment, so the whole invoice counts
   * as released and `held` and status agree again (AC-15, amended).
   */
  releaseByAdjustment(): bigint {
    if (this.status === 'closed') {
      throw new RangeError(`Reservation ${this.invoiceId} is already closed`);
    }
    const heldBefore = this.held;
    this.state = {
      ...this.state,
      held: Money.zero(heldBefore.currency),
      releasedInvoiceAmount: this.invoiceAmount,
      heldCorrection: 0n,
    };
    return -heldBefore.amount;
  }

  /**
   * ADR-0012, 3A: a snapshot lists a reservation closed at or before its moment. What the invoice
   * has left is found from the listed `held` at the stored rate, at least one minor unit so the
   * reservation is active, at most the whole invoice; the correction makes `held` exact, because
   * the round trip through two roundings need not come back to the same figure.
   */
  reopenTo(target: Money): bigint {
    if (this.status === 'active') {
      throw new RangeError(
        `Reservation ${this.invoiceId} is active; a snapshot corrects it instead`,
      );
    }
    if (target.isZero()) {
      throw new RangeError(`Reservation ${this.invoiceId} would reopen to nothing`);
    }
    const remaining = this.clampToInvoice(
      target.convertBack(this.rate, this.invoiceAmount.currency),
    );
    const converted = remaining.convert(this.rate, target.currency);
    this.state = {
      ...this.state,
      held: target,
      releasedInvoiceAmount: this.invoiceAmount.subtract(remaining),
      heldCorrection: target.amount - converted.amount,
    };
    return target.amount;
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

  /** ADR-0009 with ADR-0012's correction: nothing left means nothing held, whatever the correction. */
  private heldFor(remaining: Money): Money {
    const currency = this.held.currency;
    if (remaining.isZero()) return Money.zero(currency);
    const held = remaining.convert(this.rate, currency).amount + this.heldCorrection;
    return Money.of(held < 0n ? 0n : held, currency);
  }

  private clampToInvoice(remaining: Money): Money {
    if (remaining.isZero()) return Money.of(1n, remaining.currency);
    if (remaining.isGreaterThan(this.invoiceAmount)) return this.invoiceAmount;
    return remaining;
  }
}
