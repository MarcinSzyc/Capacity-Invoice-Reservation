import {LedgerRepository} from './ledger.repository';
import {ProgramRepository} from './program.repository';
import {ReservationRepository} from './reservation.repository';
import {TreasuryMessageStore} from './treasury-message-store';

export const UNIT_OF_WORK = Symbol('UnitOfWork');

/**
 * What a snapshot read is allowed to reach. Narrowed on purpose: the write path takes a row
 * lock and must run at read committed, so a `readSnapshot` that could write would be a way to
 * run one at repeatable read by accident.
 */
export interface CapacityReads {
  readonly programs: Pick<ProgramRepository, 'findById'>;
  readonly reservations: Pick<ReservationRepository, 'findByInvoice'>;
  readonly ledger: Pick<LedgerRepository, 'findByReservation'>;
}

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
  /**
   * Several reads that must agree with each other. One transaction is not enough: at the
   * default isolation every statement takes its own snapshot, so a writer committing between
   * two reads is invisible to the first and visible to the second. This one reads them all at
   * the same instant, and reaches only the reads, so the write path cannot end up here.
   */
  readSnapshot<T>(work: (reads: CapacityReads) => Promise<T>): Promise<T>;
}
