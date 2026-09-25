import {CapacityMovement} from './capacity-movement';
import {Ledger} from './ledger';
import {Money} from './money';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const RESERVATION_A = 'a0000000-0000-4000-8000-000000000001';
const RESERVATION_B = 'a0000000-0000-4000-8000-000000000002';
const usd = (amount: bigint): Money => Money.of(amount, USD);

const row = (overrides: Partial<CapacityMovement>): CapacityMovement => ({
  kind: 'limit_set',
  programId: PROGRAM_ID,
  reservationId: null,
  deltaHeld: 0n,
  releaseId: null,
  reason: null,
  limitAfter: usd(0n),
  reservedAfter: usd(0n),
  availableAfter: usd(0n),
  attribution: {messageId: 'm-1'},
  occurredAt: AT_10_00,
  ...overrides,
});

const LIMIT_TEN_MILLION = row({
  limitAfter: usd(1_000_000_000n),
  availableAfter: usd(1_000_000_000n),
});
const RESERVE_A = row({
  kind: 'reserve',
  reservationId: RESERVATION_A,
  deltaHeld: 400_000_000n,
  limitAfter: usd(1_000_000_000n),
  reservedAfter: usd(400_000_000n),
  availableAfter: usd(600_000_000n),
  attribution: {clientId: 'client-e2e'},
});
const RESERVE_B = row({
  kind: 'reserve',
  reservationId: RESERVATION_B,
  deltaHeld: 200_000_000n,
  limitAfter: usd(1_000_000_000n),
  reservedAfter: usd(600_000_000n),
  availableAfter: usd(400_000_000n),
  attribution: {clientId: 'client-e2e'},
});
const LIMIT_CUT_TO_THREE_MILLION = row({
  limitAfter: usd(300_000_000n),
  reservedAfter: usd(600_000_000n),
  availableAfter: usd(0n),
  attribution: {messageId: 'm-2'},
});

describe('Ledger', () => {
  it('[INV-04] should chain reserved_after from the previous row plus delta_held and recompute the stored state', () => {
    const result = Ledger.recompute([
      LIMIT_TEN_MILLION,
      RESERVE_A,
      RESERVE_B,
      LIMIT_CUT_TO_THREE_MILLION,
    ]);

    expect(result).toEqual({
      ok: true,
      state: {
        limit: usd(300_000_000n),
        reserved: usd(600_000_000n),
        available: usd(0n),
        heldByReservation: new Map([
          [RESERVATION_A, usd(400_000_000n)],
          [RESERVATION_B, usd(200_000_000n)],
        ]),
      },
    });
  });

  it('should report the first row whose reserved_after does not follow from the previous row', () => {
    const skipped = {
      ...RESERVE_B,
      reservedAfter: usd(700_000_000n),
      availableAfter: usd(300_000_000n),
    };

    const result = Ledger.recompute([LIMIT_TEN_MILLION, RESERVE_A, skipped]);

    expect(result).toEqual({
      ok: false,
      rowIndex: 2,
      reason: 'reserved_after 700000000 is not the previous 400000000 plus delta_held 200000000',
    });
  });

  it('should report a row whose available_after is not the limit minus reserved floored at zero', () => {
    const wrong = {...RESERVE_A, availableAfter: usd(700_000_000n)};

    const result = Ledger.recompute([LIMIT_TEN_MILLION, wrong]);

    expect(result).toEqual({
      ok: false,
      rowIndex: 1,
      reason: 'available_after 700000000 is not max(0, 1000000000 - 400000000)',
    });
  });

  it('should report a row that changes the limit without being a limit_set', () => {
    const smuggled = {
      ...RESERVE_A,
      limitAfter: usd(900_000_000n),
      availableAfter: usd(500_000_000n),
    };

    const result = Ledger.recompute([LIMIT_TEN_MILLION, smuggled]);

    expect(result).toEqual({
      ok: false,
      rowIndex: 1,
      reason: 'limit_after 900000000 changed on a reserve row',
    });
  });

  it('should recompute an empty ledger to nothing and a re-denominated program in its new currency', () => {
    expect(Ledger.recompute([])).toEqual({ok: true, state: null});

    const eurLimit = row({
      limitAfter: Money.of(500_000_000n, 'EUR'),
      reservedAfter: Money.zero('EUR'),
      availableAfter: Money.of(500_000_000n, 'EUR'),
      deltaHeld: 0n,
      attribution: {messageId: 'm-2'},
    });
    const result = Ledger.recompute([LIMIT_TEN_MILLION, eurLimit]);

    expect(result).toEqual({
      ok: true,
      state: {
        limit: Money.of(500_000_000n, 'EUR'),
        reserved: Money.zero('EUR'),
        available: Money.of(500_000_000n, 'EUR'),
        heldByReservation: new Map(),
      },
    });
  });
});
