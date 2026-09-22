import {LedgerRepository} from './ledger.repository';
import {ProgramRepository} from './program.repository';
import {ReservationRepository} from './reservation.repository';
import {TreasuryMessageStore} from './treasury-message-store';

export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface CapacityRepositories {
  readonly programs: ProgramRepository;
  readonly reservations: ReservationRepository;
  readonly ledger: LedgerRepository;
  readonly treasuryMessages: TreasuryMessageStore;
}

/**
 * One transaction. The repositories handed to the work are bound to it, so a program lock, the
 * ledger row and the message record commit together or not at all (A-13).
 */
export interface UnitOfWork {
  run<T>(work: (repositories: CapacityRepositories) => Promise<T>): Promise<T>;
}
