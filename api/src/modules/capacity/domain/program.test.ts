import {CapacityExceededError, CurrencyMismatchError} from './errors';
import {Money} from './money';
import {Program} from './program';

const PROGRAM_ID = 'PRG-2';
const EUR = 'EUR';
const USD = 'USD';
const FIVE_MILLION_EUR = Money.of(500_000_000n, EUR);
const NINE_MILLION_EUR = Money.of(900_000_000n, EUR);
const EIGHT_MILLION_EUR = Money.of(800_000_000n, EUR);
const TEN_MILLION_USD = Money.of(1_000_000_000n, USD);
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_10_05 = new Date('2026-09-21T10:05:00.000Z');
const MESSAGE_1 = 'm-1';
const MESSAGE_2 = 'm-2';
const CLIENT = 'client-e2e';
const RESERVATION_ID = '4d2f0c1e-0000-4000-8000-000000000001';
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');

const announcedWith = (limit: Money): Program => {
  const program = Program.announce(PROGRAM_ID, limit.currency);
  program.setLimit(limit, AT_10_00, MESSAGE_1);
  return program;
};

describe('Program', () => {
  it('should be announced by the treasury with no limit, nothing reserved and no reconciliation yet', () => {
    const program = Program.announce(PROGRAM_ID, EUR);

    expect(program.programId).toBe(PROGRAM_ID);
    expect(program.currency).toBe(EUR);
    expect(program.limit).toEqual(Money.zero(EUR));
    expect(program.reserved).toEqual(Money.zero(EUR));
    expect(program.available).toEqual(Money.zero(EUR));
    expect(program.limitEventTime).toBeNull();
    expect(program.asOf).toBeNull();
    expect(program.overcommitted).toBe(false);
  });

  it('should set the limit from the first capacity update and record one limit_set movement', () => {
    const program = Program.announce(PROGRAM_ID, EUR);

    const outcome = program.setLimit(FIVE_MILLION_EUR, AT_10_00, MESSAGE_1);

    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') return;
    expect(program.limit).toEqual(FIVE_MILLION_EUR);
    expect(program.available).toEqual(FIVE_MILLION_EUR);
    expect(program.limitEventTime).toEqual(AT_10_00);
    expect(outcome.movement).toEqual({
      kind: 'limit_set',
      programId: PROGRAM_ID,
      reservationId: null,
      deltaHeld: Money.zero(EUR),
      limitAfter: FIVE_MILLION_EUR,
      reservedAfter: Money.zero(EUR),
      availableAfter: FIVE_MILLION_EUR,
      attribution: {messageId: MESSAGE_1},
      occurredAt: AT_10_00,
    });
  });

  it('should keep the newer limit and report an older eventTime as stale', () => {
    const program = Program.announce(PROGRAM_ID, EUR);
    program.setLimit(NINE_MILLION_EUR, AT_10_05, MESSAGE_1);

    const outcome = program.setLimit(EIGHT_MILLION_EUR, AT_10_00, MESSAGE_2);

    expect(outcome).toEqual({kind: 'stale', appliedEventTime: AT_10_05});
    expect(program.limit).toEqual(NINE_MILLION_EUR);
    expect(program.limitEventTime).toEqual(AT_10_05);
  });

  it('should apply an update with the same eventTime as the last one, because it is not older', () => {
    const program = Program.announce(PROGRAM_ID, EUR);
    program.setLimit(NINE_MILLION_EUR, AT_10_05, MESSAGE_1);

    const outcome = program.setLimit(EIGHT_MILLION_EUR, AT_10_05, MESSAGE_2);

    expect(outcome.kind).toBe('applied');
    expect(program.limit).toEqual(EIGHT_MILLION_EUR);
  });

  it('should read available as zero and overcommitted when the limit drops below reserved', () => {
    const program = Program.rehydrate({
      programId: PROGRAM_ID,
      currency: EUR,
      limit: NINE_MILLION_EUR,
      reserved: Money.of(400_000_000n, EUR),
      limitEventTime: AT_10_00,
      asOf: null,
    });

    program.setLimit(Money.of(300_000_000n, EUR), AT_10_05, MESSAGE_2);

    expect(program.available).toEqual(Money.zero(EUR));
    expect(program.overcommitted).toBe(true);
    expect(program.reserved).toEqual(Money.of(400_000_000n, EUR));
  });

  it('should re-denominate a program with nothing reserved when the update carries another currency (ADR-0007)', () => {
    const program = Program.announce(PROGRAM_ID, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, MESSAGE_1);

    const outcome = program.setLimit(TEN_MILLION_USD, AT_10_05, MESSAGE_2);

    expect(outcome.kind).toBe('applied');
    expect(program.currency).toBe(USD);
    expect(program.limit).toEqual(TEN_MILLION_USD);
    expect(program.reserved).toEqual(Money.zero(USD));
    expect(program.available).toEqual(TEN_MILLION_USD);
  });

  it('should reject another currency while a reservation is active, leaving the program as it was (ADR-0007)', () => {
    const program = Program.rehydrate({
      programId: PROGRAM_ID,
      currency: EUR,
      limit: FIVE_MILLION_EUR,
      reserved: Money.of(100n, EUR),
      limitEventTime: AT_10_00,
      asOf: null,
    });

    expect(() => program.setLimit(TEN_MILLION_USD, AT_10_05, MESSAGE_2)).toThrow(
      CurrencyMismatchError,
    );
    expect(program.currency).toBe(EUR);
    expect(program.limit).toEqual(FIVE_MILLION_EUR);
    expect(program.limitEventTime).toEqual(AT_10_00);
  });

  it('should reserve within capacity, raise reserved and record a reserve movement attributed to the client', () => {
    const program = announcedWith(FIVE_MILLION_EUR);
    const held = Money.of(120_000_000n, EUR);

    const movement = program.reserve(held, CLIENT, RESERVATION_ID, AT_10_10);

    expect(program.reserved).toEqual(held);
    expect(program.available).toEqual(Money.of(380_000_000n, EUR));
    expect(program.overcommitted).toBe(false);
    expect(movement).toEqual({
      kind: 'reserve',
      programId: PROGRAM_ID,
      reservationId: RESERVATION_ID,
      deltaHeld: held,
      limitAfter: FIVE_MILLION_EUR,
      reservedAfter: held,
      availableAfter: Money.of(380_000_000n, EUR),
      attribution: {clientId: CLIENT},
      occurredAt: AT_10_10,
    });
  });

  it('should allow a reservation equal to the remaining capacity and leave nothing available (A-06)', () => {
    const program = announcedWith(FIVE_MILLION_EUR);

    program.reserve(FIVE_MILLION_EUR, CLIENT, RESERVATION_ID, AT_10_10);

    expect(program.available).toEqual(Money.zero(EUR));
    expect(program.overcommitted).toBe(false);
  });

  it('should refuse a reservation beyond available capacity, naming what is available, and change nothing', () => {
    const program = announcedWith(FIVE_MILLION_EUR);
    const tooMuch = Money.of(500_000_001n, EUR);

    let thrown: unknown;
    try {
      program.reserve(tooMuch, CLIENT, RESERVATION_ID, AT_10_10);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CapacityExceededError);
    expect((thrown as CapacityExceededError).available).toEqual(FIVE_MILLION_EUR);
    expect((thrown as CapacityExceededError).details).toEqual({available: 500_000_000n});
    expect(program.reserved).toEqual(Money.zero(EUR));
    expect(program.available).toEqual(FIVE_MILLION_EUR);
  });

  it('should refuse any positive reservation on an overcommitted program with available zero (AC-09)', () => {
    const program = Program.rehydrate({
      programId: PROGRAM_ID,
      currency: EUR,
      limit: Money.of(300_000_000n, EUR),
      reserved: Money.of(400_000_000n, EUR),
      limitEventTime: AT_10_00,
      asOf: null,
    });

    expect(() => program.reserve(Money.of(1n, EUR), CLIENT, RESERVATION_ID, AT_10_10)).toThrow(
      CapacityExceededError,
    );
    expect(program.reserved).toEqual(Money.of(400_000_000n, EUR));
  });
});
