import {Inject, Injectable} from '@nestjs/common';
import {TreasuryMessageFailure} from '../domain/ports/treasury-message-store';
import {UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';

/** A message that failed validation, with whatever could still be read from it. */
export interface TreasuryMessageRejection {
  readonly messageId: string;
  readonly programId: string | null;
  readonly type: string | null;
  readonly payload: unknown;
  readonly error: string;
  readonly receivedAt: Date;
}

export type RejectTreasuryMessageResult = 'rejected' | 'duplicate';

/**
 * A-13: a message that cannot be applied is recorded and consumption continues. Recording it
 * here rather than only in the dead-letter topic keeps one place to ask "what happened to
 * message m-7". A known id is a duplicate first, whatever the body says (glossary): it is
 * counted and nothing is published. Otherwise the dead letter goes out before the record is
 * written, so a failed publish is delivered again rather than answered "duplicate". The publish
 * waits on the broker, so it runs between two short transactions and never inside one.
 */
@Injectable()
export class RejectTreasuryMessage {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  async execute(
    rejection: TreasuryMessageRejection,
    publishDeadLetter: () => Promise<void>,
  ): Promise<RejectTreasuryMessageResult> {
    if (await this.countIfKnown(rejection.messageId)) return 'duplicate';

    await publishDeadLetter();
    await this.unitOfWork.run(({treasuryMessages}) =>
      treasuryMessages.recordOutcome({...rejection, outcome: 'rejected'}),
    );
    return 'rejected';
  }

  /**
   * ADR-0013: a failed attempt, kept in its own table. In its own short transaction, so it is
   * written even though the attempt's own transaction rolled back.
   */
  recordFailure(failure: TreasuryMessageFailure): Promise<void> {
    return this.unitOfWork.run(({treasuryMessages}) => treasuryMessages.recordFailure(failure));
  }

  private countIfKnown(messageId: string): Promise<boolean> {
    return this.unitOfWork.run(async ({treasuryMessages}) => {
      if (!(await treasuryMessages.wasProcessed(messageId))) return false;
      await treasuryMessages.recordDuplicate(messageId);
      return true;
    });
  }
}
