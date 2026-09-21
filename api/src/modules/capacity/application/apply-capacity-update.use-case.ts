import {Inject, Injectable} from '@nestjs/common';
import {CurrencyMismatchError} from '../domain/errors';
import {Money} from '../domain/money';
import {TreasuryMessageRecord} from '../domain/ports/treasury-message-store';
import {CapacityRepositories, UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';

export const CAPACITY_UPDATE_TYPE = 'capacity_update';

/** A validated capacity update (A-11), already typed: the consumer did the parsing. */
export interface CapacityUpdateCommand {
  readonly messageId: string;
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly eventTime: Date;
  /** The message as it arrived, kept next to its outcome for the audit trail. */
  readonly payload: unknown;
  readonly receivedAt: Date;
}

export type ApplyCapacityUpdateResult =
  | {readonly outcome: 'applied' | 'duplicate' | 'stale'}
  | {readonly outcome: 'rejected'; readonly reason: string; readonly error: string};

@Injectable()
export class ApplyCapacityUpdate {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(command: CapacityUpdateCommand): Promise<ApplyCapacityUpdateResult> {
    return this.unitOfWork.run(async (repositories) => {
      const {programs, treasuryMessages} = repositories;
      const program =
        (await programs.lockById(command.programId)) ??
        Program.announce(command.programId, command.currency);

      if (await treasuryMessages.wasProcessed(command.messageId)) {
        await treasuryMessages.recordDuplicate(command.messageId);
        return {outcome: 'duplicate'};
      }

      try {
        return await this.apply(program, command, repositories);
      } catch (error: unknown) {
        if (!(error instanceof CurrencyMismatchError)) throw error;
        // Not recorded here: the consumer dead-letters first and records after, so that a
        // failed publish is retried rather than answered "duplicate" next time (A-13).
        return {outcome: 'rejected', reason: error.code, error: error.message};
      }
    });
  }

  private async apply(
    program: Program,
    command: CapacityUpdateCommand,
    {programs, ledger, treasuryMessages}: CapacityRepositories,
  ): Promise<ApplyCapacityUpdateResult> {
    const limit = Money.of(command.creditLimit, command.currency);
    const outcome = program.setLimit(limit, command.eventTime, command.messageId);

    if (outcome.kind === 'stale') {
      await treasuryMessages.recordOutcome(record(command, 'stale'));
      return {outcome: 'stale'};
    }

    await programs.save(program);
    await ledger.append(outcome.movement);
    await treasuryMessages.recordOutcome(record(command, 'applied'));
    return {outcome: 'applied'};
  }
}

const record = (
  command: CapacityUpdateCommand,
  outcome: 'applied' | 'stale',
): TreasuryMessageRecord => ({
  messageId: command.messageId,
  programId: command.programId,
  type: CAPACITY_UPDATE_TYPE,
  payload: command.payload,
  outcome,
  error: null,
  receivedAt: command.receivedAt,
});
