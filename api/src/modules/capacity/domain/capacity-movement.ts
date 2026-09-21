import {Money} from './money';

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
  readonly deltaHeld: Money;
  readonly limitAfter: Money;
  readonly reservedAfter: Money;
  readonly availableAfter: Money;
  readonly attribution: MovementAttribution;
  readonly occurredAt: Date;
}
