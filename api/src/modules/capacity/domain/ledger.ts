import {CapacityMovement} from './capacity-movement';
import {Money} from './money';

export interface LedgerState {
  readonly limit: Money;
  readonly reserved: Money;
  readonly available: Money;
  /** What each reservation still holds, as the sum of its deltas. */
  readonly heldByReservation: ReadonlyMap<string, Money>;
}

export type LedgerRecomputation =
  | {readonly ok: true; readonly state: LedgerState | null}
  | {readonly ok: false; readonly rowIndex: number; readonly reason: string};

/**
 * INV-04: the ledger explains the state. Walks a program's movements in order and checks that
 * every row follows from the one before it, then returns the state the chain implies so a test
 * can compare it with what `programs` and `reservations` store. A broken chain is reported with
 * its row, never thrown: the test helper wants to say which row.
 */
export class Ledger {
  static recompute(movements: readonly CapacityMovement[]): LedgerRecomputation {
    let previous: CapacityMovement | undefined;
    const heldByReservation = new Map<string, Money>();

    for (const [rowIndex, row] of movements.entries()) {
      const reason = explainBreak(previous, row);
      if (reason !== null) return {ok: false, rowIndex, reason};
      if (row.reservationId !== null) {
        const before =
          heldByReservation.get(row.reservationId) ?? Money.zero(row.deltaHeld.currency);
        heldByReservation.set(row.reservationId, before.add(row.deltaHeld));
      }
      previous = row;
    }

    if (previous === undefined) return {ok: true, state: null};
    return {
      ok: true,
      state: {
        limit: previous.limitAfter,
        reserved: previous.reservedAfter,
        available: previous.availableAfter,
        heldByReservation,
      },
    };
  }
}

const explainBreak = (
  previous: CapacityMovement | undefined,
  row: CapacityMovement,
): string | null => {
  const sameCurrency =
    previous !== undefined && previous.limitAfter.currency === row.limitAfter.currency;
  // A re-denomination (ADR-0007) starts a fresh chain in the new currency with nothing held.
  const reservedBefore = sameCurrency ? previous.reservedAfter.amount : 0n;
  const expectedReserved = reservedBefore + row.deltaHeld.amount;
  if (row.reservedAfter.amount !== expectedReserved) {
    return `reserved_after ${row.reservedAfter.amount} is not the previous ${reservedBefore} plus delta_held ${row.deltaHeld.amount}`;
  }

  const gap = row.limitAfter.amount - row.reservedAfter.amount;
  const expectedAvailable = gap < 0n ? 0n : gap;
  if (row.availableAfter.amount !== expectedAvailable) {
    return `available_after ${row.availableAfter.amount} is not max(0, ${row.limitAfter.amount} - ${row.reservedAfter.amount})`;
  }

  if (
    sameCurrency &&
    row.kind !== 'limit_set' &&
    row.limitAfter.amount !== previous.limitAfter.amount
  ) {
    return `limit_after ${row.limitAfter.amount} changed on a ${row.kind} row`;
  }
  return null;
};
