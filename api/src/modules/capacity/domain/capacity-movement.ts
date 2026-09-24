import {Money} from './money';
import type {ReleaseReason} from './reservation';

/** Exactly four kinds (glossary, A-01). S-02 writes `limit_set`; the others arrive with S-03 to S-06. */
export type CapacityMovementKind = 'limit_set' | 'reserve' | 'release' | 'adjustment';

/** INV-09: every movement names a client or a treasury message, never neither. */
export type MovementAttribution = {readonly clientId: string} | {readonly messageId: string};

/**
 * One row of the ledger. It carries the balances it left behind (A-15), so the latest movement
 * of a program is its current state and the stored `reserved` is a copy of it.
 */
export interface CapacityMovement {
  readonly kind: CapacityMovementKind;
  readonly programId: string;
  readonly reservationId: string | null;
  /**
   * Signed minor units in the row's currency, which is `limitAfter.currency`. A release is
   * negative, which is why this is a `bigint` and not a `Money`: `Money` admits no negative
   * amount (S-02), and loosening that to serve one field would weaken every balance in the
   * domain. ADR-0009 declined a second money type for the same reason.
   */
  readonly deltaHeld: bigint;
  readonly limitAfter: Money;
  readonly reservedAfter: Money;
  readonly availableAfter: Money;
  readonly attribution: MovementAttribution;
  /** A-09: set on a release row, null on every other kind. Unique per reservation (ADR-0009). */
  readonly releaseId: string | null;
  /** A-08: why the release happened; null on every other kind. */
  readonly reason: ReleaseReason | null;
  readonly occurredAt: Date;
}
