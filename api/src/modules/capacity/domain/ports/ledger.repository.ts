import {CapacityMovement} from '../capacity-movement';

export const LEDGER_REPOSITORY = Symbol('LedgerRepository');

/** The ledger is append-only (glossary): rows are never updated or deleted. */
export interface LedgerRepository {
  append(movement: CapacityMovement): Promise<void>;
  /**
   * A reservation's own movements in time order, for the reservation read (AC-19) and for the
   * idempotency check: a release id that is already on one of these rows is a repeat (AC-16).
   */
  findByReservation(reservationId: string): Promise<CapacityMovement[]>;
}
