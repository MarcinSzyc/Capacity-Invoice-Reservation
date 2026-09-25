import {Clock} from '../../src/modules/capacity/domain/ports/clock';

/**
 * The e2e app's clock (S-06): real time until a test sets a moment, so AC-27, AC-28, AC-42 to
 * AC-44 and INV-06 can create reservations at the times the criteria are written in, through
 * the API rather than by writing rows behind it (ADR-0010).
 */
export class SettableClock implements Clock {
  private moment: Date | null = null;

  now(): Date {
    return this.moment ?? new Date();
  }

  set(moment: Date): void {
    this.moment = moment;
  }
}
