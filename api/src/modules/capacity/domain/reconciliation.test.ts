import {CurrencyMismatchError} from './errors';
import {Money} from './money';
import {Program} from './program';
import {Rate} from './rate';
import {LocalReservation, reconcile, ReconciliationSnapshot} from './reconciliation';
import {Reservation} from './reservation';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const EUR = 'EUR';
const CLIENT = 'client-e2e';
const MESSAGE = 'm-snapshot';
const KEEP_WINDOW_MS = 30_000;
const AT_09_00 = new Date('2026-09-21T09:00:00.000Z');
const AT_12_00 = new Date('2026-09-21T12:00:00.000Z');
const AT_17_59_45 = new Date('2026-09-21T17:59:45.000Z');
const AT_18_00 = new Date('2026-09-21T18:00:00.000Z');
const AT_18_00_30 = new Date('2026-09-21T18:00:30.000Z');
const AT_18_10 = new Date('2026-09-21T18:10:00.000Z');
const AT_19_00 = new Date('2026-09-21T19:00:00.000Z');
const TEN_MILLION_USD = Money.of(1_000_000_000n, USD);
const SEVEN_MILLION_USD = Money.of(700_000_000n, USD);
const ONE_POINT_NINE_TWO_FIVE_MILLION_USD = Money.of(192_500_000n, USD);
const ONE_POINT_NINE_MILLION_USD = Money.of(190_000_000n, USD);
const SEVEN_HUNDRED_THOUSAND_USD = Money.of(70_000_000n, USD);
const FIVE_HUNDRED_THOUSAND_USD = Money.of(50_000_000n, USD);
const THREE_HUNDRED_THOUSAND_USD = Money.of(30_000_000n, USD);

const programWith = (limit: Money, at: Date = AT_09_00): Program => {
  const program = Program.announce(PROGRAM_ID, limit.currency);
  program.setLimit(limit, at, 'm-limit');
  return program;
};

/** A client reservation, reserved on the program so `reserved` matches it. */
const reserved = (
  program: Program,
  invoiceId: string,
  amount: Money,
  createdAt: Date,
): Reservation => {
  const reservation = Reservation.open({
    programId: PROGRAM_ID,
    invoiceId,
    invoiceAmount: amount,
    reservedAmount: amount,
    rate: Rate.one(),
    clientId: CLIENT,
    createdAt,
  });
  program.reserve(reservation.held, CLIENT, reservation.reservationId, createdAt);
  return reservation;
};

const local = (
  reservation: Reservation,
  overrides: Partial<Omit<LocalReservation, 'reservation'>> = {},
): LocalReservation => ({
  reservation,
  deltaHeldAfterAsOf: 0n,
  closedByClientAfterAsOf: false,
  ...overrides,
});

const snapshot = (overrides: Partial<ReconciliationSnapshot> = {}): ReconciliationSnapshot => ({
  messageId: MESSAGE,
  asOf: AT_18_00,
  creditLimit: TEN_MILLION_USD,
  activeReservations: [],
  ...overrides,
});

const run = (
  program: Program,
  input: {snapshot?: Partial<ReconciliationSnapshot>; local?: LocalReservation[]} = {},
): ReturnType<typeof reconcile> =>
  reconcile({
    program,
    snapshot: snapshot(input.snapshot),
    local: input.local ?? [],
    keepWindowMs: KEEP_WINDOW_MS,
    appliedAt: AT_18_10,
  });

const applied = (
  result: ReturnType<typeof reconcile>,
): Extract<typeof result, {kind: 'applied'}> => {
  if (result.kind !== 'applied') throw new Error(`expected applied, got ${result.kind}`);
  return result;
};

describe('reconcile', () => {
  it('should create an unknown listed invoice with source reconciliation and an adjustment of what it holds (AC-26)', () => {
    const program = programWith(TEN_MILLION_USD);

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-X', held: SEVEN_HUNDRED_THOUSAND_USD}]},
      }),
    );

    expect(result.created).toHaveLength(1);
    const [created] = result.created;
    expect(created?.describe()).toMatchObject({
      invoiceId: 'INV-X',
      held: 70_000_000n,
      source: 'reconciliation',
      createdAt: AT_18_00,
    });
    const adjustment = result.movements.find((movement) => movement.kind === 'adjustment');
    expect(adjustment).toMatchObject({
      reservationId: created?.reservationId,
      deltaHeld: 70_000_000n,
      attribution: {messageId: MESSAGE},
      occurredAt: AT_18_10,
    });
    expect(program.reserved).toEqual(SEVEN_HUNDRED_THOUSAND_USD);
    expect(program.asOf).toEqual(AT_18_00);
  });

  it('should drop an active reservation created before asOf that the snapshot omits, closing it (AC-27)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceA = reserved(program, 'INV-A', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);

    const result = applied(run(program, {local: [local(invoiceA)]}));

    expect(invoiceA.status).toBe('closed');
    expect(invoiceA.held).toEqual(Money.zero(USD));
    expect(result.changed).toEqual([invoiceA]);
    expect(result.movements.filter((m) => m.kind === 'adjustment')).toEqual([
      expect.objectContaining({reservationId: invoiceA.reservationId, deltaHeld: -70_000_000n}),
    ]);
    expect(program.reserved).toEqual(Money.zero(USD));
  });

  it('should leave untouched a reservation created after asOf that the snapshot omits (AC-28)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceC = reserved(program, 'INV-C', SEVEN_HUNDRED_THOUSAND_USD, AT_18_00_30);

    const result = applied(run(program, {local: [local(invoiceC)]}));

    expect(invoiceC.held).toEqual(SEVEN_HUNDRED_THOUSAND_USD);
    expect(result.changed).toEqual([]);
    expect(result.movements.map((m) => m.kind)).toEqual(['limit_set']);
  });

  it('should keep an omitted reservation created within the keep window before asOf, and say so (AC-42)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceD = reserved(program, 'INV-D', SEVEN_HUNDRED_THOUSAND_USD, AT_17_59_45);

    const result = applied(run(program, {local: [local(invoiceD)]}));

    expect(invoiceD.status).toBe('active');
    expect(result.changed).toEqual([]);
    expect(result.notes).toContainEqual({kind: 'kept_within_window', invoiceId: 'INV-D'});
  });

  it('should correct a listed reservation to the snapshot figure with an adjustment for the difference (AC-29)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceB = reserved(program, 'INV-B', ONE_POINT_NINE_TWO_FIVE_MILLION_USD, AT_09_00);

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-B', held: ONE_POINT_NINE_MILLION_USD}]},
        local: [local(invoiceB)],
      }),
    );

    expect(invoiceB.held).toEqual(ONE_POINT_NINE_MILLION_USD);
    expect(result.movements.filter((m) => m.kind === 'adjustment')).toEqual([
      expect.objectContaining({deltaHeld: -2_500_000n}),
    ]);
    expect(program.reserved).toEqual(ONE_POINT_NINE_MILLION_USD);
  });

  it('should record nothing for a listed reservation that already holds the snapshot figure', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceB = reserved(program, 'INV-B', ONE_POINT_NINE_MILLION_USD, AT_09_00);

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-B', held: ONE_POINT_NINE_MILLION_USD}]},
        local: [local(invoiceB)],
      }),
    );

    expect(result.changed).toEqual([]);
    expect(result.movements.map((m) => m.kind)).toEqual(['limit_set']);
  });

  it('should judge a listed reservation as of asOf, so a release after it stands (AC-43)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceB = reserved(program, 'INV-B', ONE_POINT_NINE_TWO_FIVE_MILLION_USD, AT_09_00);
    const release = invoiceB.release({amount: FIVE_HUNDRED_THOUSAND_USD});
    program.release({
      deltaHeld: release.deltaHeld,
      clientId: CLIENT,
      reservationId: invoiceB.reservationId,
      releaseId: 'R-1',
      reason: 'repaid',
      occurredAt: AT_18_10,
    });

    applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-B', held: ONE_POINT_NINE_MILLION_USD}]},
        local: [local(invoiceB, {deltaHeldAfterAsOf: release.deltaHeld})],
      }),
    );

    // 1 900 000 as of 18:00, less the 500 000 released at 18:10, is 1 400 000.
    expect(invoiceB.held).toEqual(Money.of(140_000_000n, USD));
    expect(program.reserved).toEqual(Money.of(140_000_000n, USD));
  });

  it('should reopen a reservation closed before asOf that the snapshot lists (AC-44)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceF = reserved(program, 'INV-F', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);
    applied(run(program, {snapshot: {asOf: AT_12_00}, local: [local(invoiceF)]}));
    expect(invoiceF.status).toBe('closed');

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-F', held: THREE_HUNDRED_THOUSAND_USD}]},
        local: [local(invoiceF)],
      }),
    );

    expect(invoiceF.status).toBe('active');
    expect(invoiceF.held).toEqual(THREE_HUNDRED_THOUSAND_USD);
    expect(result.movements.filter((m) => m.kind === 'adjustment')).toEqual([
      expect.objectContaining({deltaHeld: 30_000_000n}),
    ]);
  });

  it('should leave closed a reservation the client fully released after asOf', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceF = reserved(program, 'INV-F', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);
    const release = invoiceF.release({amount: null});

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-F', held: THREE_HUNDRED_THOUSAND_USD}]},
        local: [
          local(invoiceF, {deltaHeldAfterAsOf: release.deltaHeld, closedByClientAfterAsOf: true}),
        ],
      }),
    );

    expect(invoiceF.status).toBe('closed');
    expect(result.changed).toEqual([]);
    expect(result.notes).toContainEqual({kind: 'kept_closed_after_as_of', invoiceId: 'INV-F'});
  });

  it('should never touch a listed reservation created after asOf (INV-06)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceC = reserved(program, 'INV-C', SEVEN_HUNDRED_THOUSAND_USD, AT_18_00_30);

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-C', held: THREE_HUNDRED_THOUSAND_USD}]},
        local: [local(invoiceC)],
      }),
    );

    expect(invoiceC.held).toEqual(SEVEN_HUNDRED_THOUSAND_USD);
    expect(result.changed).toEqual([]);
    expect(result.notes).toContainEqual({kind: 'listed_after_as_of', invoiceId: 'INV-C'});
  });

  it('should compare a reservation it created at asOf with a later snapshot of the same moment', () => {
    const program = programWith(TEN_MILLION_USD);
    const first = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-X', held: SEVEN_HUNDRED_THOUSAND_USD}]},
      }),
    );
    const [invoiceX] = first.created;
    if (invoiceX === undefined) throw new Error('INV-X was not created');

    applied(
      run(program, {
        snapshot: {
          messageId: 'm-again',
          activeReservations: [{invoiceId: 'INV-X', held: THREE_HUNDRED_THOUSAND_USD}],
        },
        local: [local(invoiceX)],
      }),
    );

    expect(invoiceX.held).toEqual(THREE_HUNDRED_THOUSAND_USD);
  });

  it('should change nothing for a snapshot older than the last applied one (AC-30)', () => {
    const program = programWith(TEN_MILLION_USD);
    applied(run(program, {snapshot: {asOf: AT_18_00}}));

    const result = run(program, {snapshot: {asOf: AT_12_00, creditLimit: SEVEN_MILLION_USD}});

    expect(result).toEqual({kind: 'stale', appliedAsOf: AT_18_00});
    expect(program.limit).toEqual(TEN_MILLION_USD);
    expect(program.asOf).toEqual(AT_18_00);
  });

  it('should set the limit from the snapshot and remember its moment (AC-31)', () => {
    const program = programWith(TEN_MILLION_USD);

    const result = applied(run(program, {snapshot: {creditLimit: SEVEN_MILLION_USD}}));

    expect(program.limit).toEqual(SEVEN_MILLION_USD);
    expect(program.limitEventTime).toEqual(AT_18_00);
    expect(program.asOf).toEqual(AT_18_00);
    expect(result.movements[0]).toMatchObject({
      kind: 'limit_set',
      attribution: {messageId: MESSAGE},
    });
  });

  it('should apply the reservations and skip the limit of a snapshot older than the last capacity update', () => {
    const program = programWith(TEN_MILLION_USD, AT_19_00);

    const result = applied(
      run(program, {
        snapshot: {
          creditLimit: SEVEN_MILLION_USD,
          activeReservations: [{invoiceId: 'INV-X', held: SEVEN_HUNDRED_THOUSAND_USD}],
        },
      }),
    );

    expect(program.limit).toEqual(TEN_MILLION_USD);
    expect(program.limitEventTime).toEqual(AT_19_00);
    expect(program.asOf).toEqual(AT_18_00);
    expect(result.created).toHaveLength(1);
    expect(result.movements.map((m) => m.kind)).toEqual(['adjustment']);
    expect(result.notes).toContainEqual({kind: 'limit_skipped'});
  });

  it('should create nothing for an unknown invoice listed with a held of zero', () => {
    const program = programWith(TEN_MILLION_USD);

    const result = applied(
      run(program, {
        snapshot: {activeReservations: [{invoiceId: 'INV-Z', held: Money.zero(USD)}]},
      }),
    );

    expect(result.created).toEqual([]);
    expect(result.notes).toContainEqual({kind: 'listed_with_nothing_held', invoiceId: 'INV-Z'});
  });

  it('should write the limit first and then one adjustment per invoice in invoice id order', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceA = reserved(program, 'INV-A', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);

    const result = applied(
      run(program, {
        snapshot: {
          creditLimit: SEVEN_MILLION_USD,
          activeReservations: [
            {invoiceId: 'INV-Y', held: THREE_HUNDRED_THOUSAND_USD},
            {invoiceId: 'INV-B', held: THREE_HUNDRED_THOUSAND_USD},
          ],
        },
        local: [local(invoiceA)],
      }),
    );

    const invoiceOf = new Map(
      [...result.created, ...result.changed].map((r) => [r.reservationId, r.invoiceId]),
    );
    expect(result.movements.map((m) => m.kind)).toEqual([
      'limit_set',
      'adjustment',
      'adjustment',
      'adjustment',
    ]);
    expect(result.movements.slice(1).map((m) => invoiceOf.get(m.reservationId ?? ''))).toEqual([
      'INV-A',
      'INV-B',
      'INV-Y',
    ]);
  });

  it('should refuse another currency while a reservation is active and change nothing (ADR-0007)', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceA = reserved(program, 'INV-A', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);

    expect(() =>
      run(program, {
        snapshot: {creditLimit: Money.of(500_000_000n, EUR)},
        local: [local(invoiceA)],
      }),
    ).toThrow(CurrencyMismatchError);
    expect(program.currency).toBe(USD);
    expect(program.asOf).toBeNull();
    expect(invoiceA.held).toEqual(SEVEN_HUNDRED_THOUSAND_USD);
  });

  it('should re-denominate an empty program from a snapshot in another currency (ADR-0007)', () => {
    const program = programWith(TEN_MILLION_USD);

    applied(
      run(program, {
        snapshot: {
          creditLimit: Money.of(500_000_000n, EUR),
          activeReservations: [{invoiceId: 'INV-X', held: Money.of(70_000_000n, EUR)}],
        },
      }),
    );

    expect(program.currency).toBe(EUR);
    expect(program.reserved).toEqual(Money.of(70_000_000n, EUR));
  });

  it('should refuse another currency when the limit part would be stale, since the limit could not be re-expressed', () => {
    const program = programWith(TEN_MILLION_USD, AT_19_00);

    expect(() => run(program, {snapshot: {creditLimit: Money.of(500_000_000n, EUR)}})).toThrow(
      CurrencyMismatchError,
    );
    expect(program.currency).toBe(USD);
  });

  it('should refuse another currency when the snapshot lists a closed reservation of the old one', () => {
    const program = programWith(TEN_MILLION_USD);
    const invoiceF = reserved(program, 'INV-F', SEVEN_HUNDRED_THOUSAND_USD, AT_09_00);
    invoiceF.release({amount: null});
    program.release({
      deltaHeld: -70_000_000n,
      clientId: CLIENT,
      reservationId: invoiceF.reservationId,
      releaseId: 'R-1',
      reason: 'repaid',
      occurredAt: AT_12_00,
    });

    expect(() =>
      run(program, {
        snapshot: {
          creditLimit: Money.of(500_000_000n, EUR),
          activeReservations: [{invoiceId: 'INV-F', held: Money.of(30_000_000n, EUR)}],
        },
        local: [local(invoiceF)],
      }),
    ).toThrow(CurrencyMismatchError);
  });

  it('should apply a snapshot from ahead of our clock and say so when it is beyond the keep window', () => {
    const program = programWith(TEN_MILLION_USD);

    const result = applied(
      reconcile({
        program,
        snapshot: snapshot({asOf: AT_19_00}),
        local: [],
        keepWindowMs: KEEP_WINDOW_MS,
        appliedAt: AT_18_10,
      }),
    );

    expect(program.asOf).toEqual(AT_19_00);
    expect(result.notes).toContainEqual({kind: 'as_of_ahead_of_our_clock'});
  });

  it('should not warn about a snapshot moment within the keep window of our clock', () => {
    const result = applied(
      reconcile({
        program: programWith(TEN_MILLION_USD),
        snapshot: snapshot({asOf: new Date(AT_18_10.getTime() + KEEP_WINDOW_MS)}),
        local: [],
        keepWindowMs: KEEP_WINDOW_MS,
        appliedAt: AT_18_10,
      }),
    );

    expect(result.notes).toEqual([]);
  });
});
