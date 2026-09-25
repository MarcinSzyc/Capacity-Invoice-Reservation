import {CapacityMovement} from '../capacity-movement';

/** The ledger is append-only (glossary): rows are never updated or deleted. */
export interface LedgerRepository {
  append(movement: CapacityMovement): Promise<void>;
  /** Several rows in one statement, appended in the order given, which is the order they chain in. */
  appendAll(movements: readonly CapacityMovement[]): Promise<void>;
  /**
   * A reservation's own movements in time order, for the reservation read (AC-19) and for the
   * idempotency check: a release id that is already on one of these rows is a repeat (AC-16).
   */
  findByReservation(reservationId: string): Promise<CapacityMovement[]>;
  /** The most recent row of each reservation asked for, in one read (ADR-0012, 3A). */
  findLastByReservations(reservationIds: readonly string[]): Promise<Map<string, CapacityMovement>>;
  /**
   * ADR-0012, 2A: a program's `reserve` and `release` rows that occurred after a moment, in the
   * order they were appended. One read per snapshot, not one per reservation.
   */
  findClientMovementsSince(programId: string, since: Date): Promise<CapacityMovement[]>;
}
