import {randomUUID} from 'node:crypto';
import {Money} from './money';

/** Who created the reservation: the client over HTTP, or a reconciliation snapshot (S-06). */
export type ReservationSource = 'client' | 'reconciliation';

/** Derived from `held`, never stored (glossary: active and closed reservation). */
export type ReservationStatus = 'active' | 'closed';

export interface ReservationState {
  /** Storage identity, never shown on the API; the public identity is `invoiceId` (A-07). */
  readonly reservationId: string;
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: Money;
  readonly reservedAmount: Money;
  readonly held: Money;
  readonly source: ReservationSource;
  readonly clientId: string | null;
  readonly createdAt: Date;
}

export interface OpenReservation {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: Money;
  readonly reservedAmount: Money;
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
  readonly status: ReservationStatus;
  readonly source: ReservationSource;
  readonly createdAt: Date;
}

/**
 * The claim one invoice holds on a program's capacity (glossary). Three amounts: what the
 * client sent, what that took from the limit at creation, and how much of it still occupies the
 * limit. In this slice the first two are equal because the currencies are; S-04 adds the rate.
 */
export class Reservation {
  private constructor(private readonly state: ReservationState) {}

  static open(request: OpenReservation): Reservation {
    return new Reservation({
      reservationId: randomUUID(),
      programId: request.programId,
      invoiceId: request.invoiceId,
      invoiceAmount: request.invoiceAmount,
      reservedAmount: request.reservedAmount,
      held: request.reservedAmount,
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

  get status(): ReservationStatus {
    return this.state.held.isZero() ? 'closed' : 'active';
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

  describe(): ReservationDescription {
    return {
      programId: this.programId,
      invoiceId: this.invoiceId,
      invoiceAmount: this.invoiceAmount.amount,
      invoiceCurrency: this.invoiceAmount.currency,
      reservedAmount: this.reservedAmount.amount,
      held: this.held.amount,
      status: this.status,
      source: this.source,
      createdAt: this.createdAt,
    };
  }
}
