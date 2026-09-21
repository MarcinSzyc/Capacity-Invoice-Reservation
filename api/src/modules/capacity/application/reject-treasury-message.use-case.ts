import {Inject, Injectable} from '@nestjs/common';
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

/**
 * A-13: a malformed message is recorded and consumption continues. Recording it here rather
 * than only in the dead-letter topic keeps one place to ask "what happened to message m-7".
 */
@Injectable()
export class RejectTreasuryMessage {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(rejection: TreasuryMessageRejection): Promise<void> {
    return this.unitOfWork.run(async ({treasuryMessages}) => {
      if (await treasuryMessages.wasProcessed(rejection.messageId)) {
        await treasuryMessages.recordDuplicate(rejection.messageId);
        return;
      }
      await treasuryMessages.recordOutcome({...rejection, outcome: 'rejected'});
    });
  }
}
