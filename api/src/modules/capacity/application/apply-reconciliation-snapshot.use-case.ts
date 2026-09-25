import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {CurrencyMismatchError} from '../domain/errors';
import {Money} from '../domain/money';
import {CLOCK, Clock} from '../domain/ports/clock';
import {TreasuryMessageRecord} from '../domain/ports/treasury-message-store';
import {CapacityRepositories, UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';
import {
  LocalReservation,
  reconcile,
  ReconciliationNote,
  ReconciliationSnapshot,
} from '../domain/reconciliation';
import {Reservation} from '../domain/reservation';

export const RECONCILIATION_SNAPSHOT_TYPE = 'reconciliation_snapshot';

/** ADR-0010: the keep window in milliseconds, provided from configuration. */
export const RECONCILIATION_KEEP_WINDOW_MS = Symbol('ReconciliationKeepWindowMs');

/** A validated snapshot (A-11), already typed: the consumer did the parsing. */
export interface ReconciliationSnapshotCommand {
  readonly messageId: string;
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly asOf: Date;
  /** In the snapshot's currency, minor units. */
  readonly activeReservations: readonly {readonly invoiceId: string; readonly heldAmount: bigint}[];
  /** The message as it arrived, kept next to its outcome for the audit trail. */
  readonly payload: unknown;
  readonly receivedAt: Date;
}

export type ApplyReconciliationSnapshotResult =
  | {readonly outcome: 'applied'; readonly notes: readonly ReconciliationNote[]}
  | {readonly outcome: 'duplicate' | 'stale'}
  | {readonly outcome: 'rejected'; readonly reason: string; readonly error: string};

/**
 * A-12, A-13: the same shape as `ApplyCapacityUpdate`. One transaction behind the program row
 * lock (ADR-0008), so a snapshot and a client request on one program are judged one after the
 * other; duplicate first, then stale, then rejected (A-13, clause 5). The rules themselves are
 * `reconcile`'s; this reads what it needs and writes what it decided.
 */
@Injectable()
export class ApplyReconciliationSnapshot {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RECONCILIATION_KEEP_WINDOW_MS) private readonly keepWindowMs: number,
  ) {}

  execute(command: ReconciliationSnapshotCommand): Promise<ApplyReconciliationSnapshotResult> {
    return this.unitOfWork.run(async (repositories) => {
      const {programs, treasuryMessages} = repositories;
      const program =
        (await programs.lockById(command.programId)) ??
        Program.announce(command.programId, command.currency);

      if (await treasuryMessages.wasProcessed(command.messageId)) {
        await treasuryMessages.recordDuplicate(command.messageId);
        return {outcome: 'duplicate'};
      }
      if (program.isStaleSnapshot(command.asOf)) {
        await treasuryMessages.recordOutcome(record(command, 'stale'));
        return {outcome: 'stale'};
      }

      try {
        return await this.apply(program, command, repositories);
      } catch (error: unknown) {
        if (!(error instanceof CurrencyMismatchError)) throw error;
        // Not recorded here: the consumer dead-letters first and records after (A-13).
        return {outcome: 'rejected', reason: error.code, error: error.message};
      }
    });
  }

  private async apply(
    program: Program,
    command: ReconciliationSnapshotCommand,
    repositories: CapacityRepositories,
  ): Promise<ApplyReconciliationSnapshotResult> {
    const {programs, reservations, ledger, treasuryMessages} = repositories;
    const result = reconcile({
      program,
      snapshot: toSnapshot(command),
      local: await this.localReservations(command, repositories),
      keepWindowMs: this.keepWindowMs,
      appliedAt: this.clock.now(),
    });
    // Checked before the reads too, so this is only the type's other branch.
    if (result.kind === 'stale') {
      await treasuryMessages.recordOutcome(record(command, 'stale'));
      return {outcome: 'stale'};
    }

    // Foreign keys: the program before its reservations, both before the rows that name them.
    await programs.save(program);
    for (const reservation of result.created) await reservations.add(reservation);
    for (const reservation of result.changed) await reservations.save(reservation);
    for (const movement of result.movements) await ledger.append(movement);
    await treasuryMessages.recordOutcome(record(command, 'applied'));
    return {outcome: 'applied', notes: result.notes};
  }

  /**
   * Every active reservation and every listed one we know, each with what the client did after
   * `asOf` (ADR-0012). The closing movement of a closed one is read on its own, since only a few
   * listed reservations are ever closed.
   */
  private async localReservations(
    command: ReconciliationSnapshotCommand,
    {reservations, ledger}: CapacityRepositories,
  ): Promise<LocalReservation[]> {
    const listedIds = command.activeReservations.map((listed) => listed.invoiceId);
    const active = await reservations.findActiveByProgram(command.programId);
    const listed = await reservations.findByInvoices(command.programId, listedIds);
    const byId = new Map([...active, ...listed].map((r) => [r.reservationId, r]));
    const after = await ledger.findClientMovementsSince(command.programId, command.asOf);

    const local: LocalReservation[] = [];
    for (const reservation of byId.values()) {
      local.push({
        reservation,
        deltaHeldAfterAsOf: sumOfDeltas(after, reservation.reservationId),
        closedByClientAfterAsOf: await closedByClientAfter(reservation, command.asOf, ledger),
      });
    }
    return local;
  }
}

const sumOfDeltas = (movements: readonly CapacityMovement[], reservationId: string): bigint =>
  movements
    .filter((movement) => movement.reservationId === reservationId)
    .reduce((sum, movement) => sum + movement.deltaHeld, 0n);

const closedByClientAfter = async (
  reservation: Reservation,
  asOf: Date,
  ledger: CapacityRepositories['ledger'],
): Promise<boolean> => {
  if (reservation.status === 'active') return false;
  const closing = (await ledger.findByReservation(reservation.reservationId)).at(-1);
  return closing?.kind === 'release' && closing.occurredAt > asOf;
};

const toSnapshot = (command: ReconciliationSnapshotCommand): ReconciliationSnapshot => ({
  messageId: command.messageId,
  asOf: command.asOf,
  creditLimit: Money.of(command.creditLimit, command.currency),
  activeReservations: command.activeReservations.map((listed) => ({
    invoiceId: listed.invoiceId,
    held: Money.of(listed.heldAmount, command.currency),
  })),
});

const record = (
  command: ReconciliationSnapshotCommand,
  outcome: 'applied' | 'stale',
): TreasuryMessageRecord => ({
  messageId: command.messageId,
  programId: command.programId,
  type: RECONCILIATION_SNAPSHOT_TYPE,
  payload: command.payload,
  outcome,
  error: null,
  receivedAt: command.receivedAt,
});
