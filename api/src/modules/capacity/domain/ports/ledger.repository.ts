import {CapacityMovement} from '../capacity-movement';

/** The ledger is append-only (glossary): rows are never updated or deleted. */
export interface LedgerRepository {
  append(movement: CapacityMovement): Promise<void>;
}
