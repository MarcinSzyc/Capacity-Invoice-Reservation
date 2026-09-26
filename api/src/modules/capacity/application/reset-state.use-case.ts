import {Inject, Injectable} from '@nestjs/common';
import {STATE_RESET, StateReset} from '../domain/ports/state-reset';

/**
 * The demo page's reset: every program, reservation, movement and treasury message removed, so a
 * reviewer starts from nothing. Provided only by the dev module, so production has no way to it.
 */
@Injectable()
export class ResetState {
  constructor(@Inject(STATE_RESET) private readonly stateReset: StateReset) {}

  execute(): Promise<void> {
    return this.stateReset.resetAll();
  }
}
