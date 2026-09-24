import {CapacityMovement} from './capacity-movement';
import type {ReleaseReason} from './reservation';
import {CapacityExceededError, CurrencyMismatchError} from './errors';
import {Money} from './money';

export interface ProgramState {
  readonly programId: string;
  readonly currency: string;
  readonly limit: Money;
  readonly reserved: Money;
  readonly limitEventTime: Date | null;
  readonly asOf: Date | null;
}

export type SetLimitOutcome =
  | {readonly kind: 'applied'; readonly movement: CapacityMovement}
  | {readonly kind: 'stale'; readonly appliedEventTime: Date};

/** What a release needs from the caller to become a ledger row (ADR-0009). */
export interface ReleaseMovementRequest {
  /** Negative minor units of the program currency: a release lowers `reserved`. */
  readonly deltaHeld: bigint;
  readonly clientId: string;
  readonly reservationId: string;
  readonly releaseId: string;
  readonly reason: ReleaseReason;
  readonly occurredAt: Date;
}

/**
 * A pot of money the treasury sets aside (glossary). The treasury owns its limit and currency
 * (A-05); clients only draw from it. `available = max(0, limit - reserved)` (A-06).
 */
export class Program {
  private constructor(
    readonly programId: string,
    private state: Omit<ProgramState, 'programId'>,
  ) {}

  /** The first treasury message about a program brings it into existence (A-05, AC-20). */
  static announce(programId: string, currency: string): Program {
    return new Program(programId, {
      currency,
      limit: Money.zero(currency),
      reserved: Money.zero(currency),
      limitEventTime: null,
      asOf: null,
    });
  }

  /** For repositories only: a program read back from storage. */
  static rehydrate(state: ProgramState): Program {
    const {programId, ...rest} = state;
    return new Program(programId, rest);
  }

  get currency(): string {
    return this.state.currency;
  }

  get limit(): Money {
    return this.state.limit;
  }

  get reserved(): Money {
    return this.state.reserved;
  }

  get limitEventTime(): Date | null {
    return this.state.limitEventTime;
  }

  get asOf(): Date | null {
    return this.state.asOf;
  }

  get available(): Money {
    if (this.overcommitted) return Money.zero(this.currency);
    return this.limit.subtract(this.reserved);
  }

  get overcommitted(): boolean {
    return this.reserved.isGreaterThan(this.limit);
  }

  /**
   * A capacity update (A-11). Older than the last applied one is stale and changes nothing
   * (A-13, INV-07). Another currency re-denominates an empty program and is refused on one with
   * anything held (ADR-0007).
   */
  setLimit(limit: Money, eventTime: Date, messageId: string): SetLimitOutcome {
    const applied = this.state.limitEventTime;
    if (applied !== null && eventTime < applied) return {kind: 'stale', appliedEventTime: applied};

    if (limit.currency !== this.currency) this.redenominate(limit.currency);

    this.state = {...this.state, limit, limitEventTime: eventTime};
    return {kind: 'applied', movement: this.movement('limit_set', {messageId}, eventTime)};
  }

  /**
   * A client takes `held` from the capacity (A-06). Equal to what is available is allowed; more
   * is refused with what is available in the error, and on an overcommitted program that is
   * zero, so nothing positive gets through (AC-09). ADR-0008: the caller holds the row lock.
   */
  reserve(
    held: Money,
    clientId: string,
    reservationId: string,
    occurredAt: Date,
  ): CapacityMovement {
    // Validation stops a zero on HTTP; the domain refuses it too, so no path (S-06 arrives over
    // Kafka) can open a reservation that is closed at birth with an empty reserve row.
    if (held.isZero()) throw new RangeError(`Reservation ${reservationId} would hold nothing`);
    if (held.isGreaterThan(this.available)) {
      throw new CapacityExceededError(this.programId, this.available);
    }
    this.state = {...this.state, reserved: this.reserved.add(held)};
    return {
      ...this.movement('reserve', {clientId}, occurredAt),
      reservationId,
      deltaHeld: held.amount,
    };
  }

  /**
   * A-08: a release gives capacity back. `deltaHeld` is negative minor units of this program's
   * currency (ADR-0009); `Money.of` refuses a `reserved` that would go below zero, which is
   * INV-03 holding at the one place that lowers it. An overcommitted program may stop being
   * overcommitted here, with no special case: `available` is the same formula either way.
   */
  release(request: ReleaseMovementRequest): CapacityMovement {
    // A release gives capacity back or leaves it where it is, and never takes more than the
    // program holds. A delta of zero is legitimate and not rare: once a remainder has rounded
    // `held` to zero, closing the invoice gives nothing back but is still a repayment the
    // ledger must record (AC-15, amended). Only a delta that raises `held` is a broken caller,
    // and it is refused here rather than reaching `Money.of` as a bare range error, which
    // would leave the client a 500.
    if (request.deltaHeld > 0n) {
      throw new RangeError(`Release ${request.releaseId} would raise held by ${request.deltaHeld}`);
    }
    if (this.reserved.amount + request.deltaHeld < 0n) {
      throw new RangeError(
        `Release ${request.releaseId} would take reserved of ${this.programId} below zero`,
      );
    }
    this.state = {
      ...this.state,
      reserved: Money.of(this.reserved.amount + request.deltaHeld, this.currency),
    };
    return {
      ...this.movement('release', {clientId: request.clientId}, request.occurredAt),
      reservationId: request.reservationId,
      deltaHeld: request.deltaHeld,
      releaseId: request.releaseId,
      reason: request.reason,
    };
  }

  private redenominate(currency: string): void {
    if (!this.reserved.isZero()) {
      throw new CurrencyMismatchError(this.currency, currency, `Program ${this.programId}`);
    }
    this.state = {...this.state, currency, reserved: Money.zero(currency)};
  }

  private movement(
    kind: CapacityMovement['kind'],
    attribution: CapacityMovement['attribution'],
    occurredAt: Date,
  ): CapacityMovement {
    return {
      kind,
      programId: this.programId,
      reservationId: null,
      deltaHeld: 0n,
      releaseId: null,
      reason: null,
      limitAfter: this.limit,
      reservedAfter: this.reserved,
      availableAfter: this.available,
      attribution,
      occurredAt,
    };
  }
}
