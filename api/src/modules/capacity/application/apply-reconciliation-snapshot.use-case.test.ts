import {Money} from '../domain/money';
import {ApplyCapacityUpdate} from './apply-capacity-update.use-case';
import {
  ApplyReconciliationSnapshot,
  ReconciliationSnapshotCommand,
} from './apply-reconciliation-snapshot.use-case';
import {ReleaseCapacity} from './release-capacity.use-case';
import {ReserveCapacity} from './reserve-capacity.use-case';
import {FixedClock, inMemoryCapacity, InMemoryUnitOfWork} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const EUR = 'EUR';
const CLIENT = 'client-e2e';
const KEEP_WINDOW_MS = 30_000;
const AT_09_00 = new Date('2026-09-21T09:00:00.000Z');
const AT_12_00 = new Date('2026-09-21T12:00:00.000Z');
const AT_18_00 = new Date('2026-09-21T18:00:00.000Z');
const AT_18_05 = new Date('2026-09-21T18:05:00.000Z');
const AT_18_10 = new Date('2026-09-21T18:10:00.000Z');
const RECEIVED_AT = AT_18_10;
const TEN_MILLION = 1_000_000_000n;
const SEVEN_MILLION = 700_000_000n;
const ONE_POINT_NINE_TWO_FIVE_MILLION = 192_500_000n;
const ONE_POINT_NINE_MILLION = 190_000_000n;
const FIVE_HUNDRED_THOUSAND = 50_000_000n;

const command = (
  overrides: Partial<ReconciliationSnapshotCommand> = {},
): ReconciliationSnapshotCommand => ({
  messageId: 'm-snapshot',
  programId: PROGRAM_ID,
  currency: USD,
  creditLimit: TEN_MILLION,
  asOf: AT_18_00,
  activeReservations: [],
  payload: {messageId: 'm-snapshot', type: 'reconciliation_snapshot'},
  receivedAt: RECEIVED_AT,
  ...overrides,
});

const snapshotUseCase = (capacity: InMemoryUnitOfWork): ApplyReconciliationSnapshot =>
  new ApplyReconciliationSnapshot(capacity, new FixedClock(AT_18_10), KEEP_WINDOW_MS);

/** A USD program of 10 000 000 with INV-B reserved by a client at 09:00 for 1 925 000. */
const programHoldingInvoiceB = async (): Promise<InMemoryUnitOfWork> => {
  const capacity = inMemoryCapacity();
  await new ApplyCapacityUpdate(capacity).execute({
    messageId: 'm-limit',
    programId: PROGRAM_ID,
    currency: USD,
    creditLimit: TEN_MILLION,
    eventTime: AT_09_00,
    payload: {},
    receivedAt: AT_09_00,
  });
  await new ReserveCapacity(capacity, new FixedClock(AT_09_00)).execute({
    programId: PROGRAM_ID,
    invoiceId: 'INV-B',
    invoiceAmount: ONE_POINT_NINE_TWO_FIVE_MILLION,
    invoiceCurrency: USD,
    rate: null,
    clientId: CLIENT,
  });
  return capacity;
};

const releaseInvoiceB = (
  capacity: InMemoryUnitOfWork,
  at: Date,
  amount: bigint | null,
): Promise<unknown> =>
  new ReleaseCapacity(capacity, new FixedClock(at)).execute({
    programId: PROGRAM_ID,
    invoiceId: 'INV-B',
    releaseId: `R-${at.toISOString()}`,
    amount,
    reason: 'repaid',
    clientId: CLIENT,
  });

const invoiceB = (capacity: InMemoryUnitOfWork) =>
  capacity.repositories.reservations.all.find((r) => r.invoiceId === 'INV-B');

describe('ApplyReconciliationSnapshot', () => {
  it('should create an unknown program from a snapshot, apply it and record the message as applied (A-05)', async () => {
    const capacity = inMemoryCapacity();

    const result = await snapshotUseCase(capacity).execute(
      command({activeReservations: [{invoiceId: 'INV-X', heldAmount: SEVEN_MILLION}]}),
    );

    expect(result).toEqual({outcome: 'applied', notes: []});
    const program = capacity.repositories.programs.byId.get(PROGRAM_ID);
    expect(program?.limit).toEqual(Money.of(TEN_MILLION, USD));
    expect(program?.reserved).toEqual(Money.of(SEVEN_MILLION, USD));
    expect(program?.asOf).toEqual(AT_18_00);
    expect(capacity.repositories.reservations.all).toHaveLength(1);
    expect(capacity.repositories.ledger.movements.map((m) => m.kind)).toEqual([
      'limit_set',
      'adjustment',
    ]);
    expect(capacity.repositories.treasuryMessages.byId.get('m-snapshot')).toMatchObject({
      outcome: 'applied',
      programId: PROGRAM_ID,
      type: 'reconciliation_snapshot',
      receivedAt: RECEIVED_AT,
    });
  });

  it('should record a repeated messageId as duplicate and change nothing (A-13)', async () => {
    const capacity = inMemoryCapacity();
    const useCase = snapshotUseCase(capacity);
    await useCase.execute(command());

    const result = await useCase.execute(
      command({activeReservations: [{invoiceId: 'INV-X', heldAmount: SEVEN_MILLION}]}),
    );

    expect(result).toEqual({outcome: 'duplicate'});
    expect(capacity.repositories.reservations.all).toHaveLength(0);
    expect(capacity.repositories.treasuryMessages.byId.get('m-snapshot')?.duplicateCount).toBe(1);
  });

  it('should record an older snapshot as stale and change nothing (AC-30)', async () => {
    const capacity = await programHoldingInvoiceB();
    const useCase = snapshotUseCase(capacity);
    await useCase.execute(command({messageId: 'm-18', asOf: AT_18_00}));
    const movementsBefore = capacity.repositories.ledger.movements.length;

    const result = await useCase.execute(
      command({messageId: 'm-12', asOf: AT_12_00, creditLimit: SEVEN_MILLION}),
    );

    expect(result).toEqual({outcome: 'stale'});
    expect(capacity.repositories.ledger.movements).toHaveLength(movementsBefore);
    expect(capacity.repositories.treasuryMessages.byId.get('m-12')?.outcome).toBe('stale');
  });

  it('should reject another currency while a reservation is active, leaving the record to the caller (ADR-0007)', async () => {
    const capacity = await programHoldingInvoiceB();
    const movementsBefore = capacity.repositories.ledger.movements.length;

    const result = await snapshotUseCase(capacity).execute(
      command({currency: EUR, creditLimit: TEN_MILLION}),
    );

    expect(result).toEqual({
      outcome: 'rejected',
      reason: 'CURRENCY_MISMATCH',
      error: expect.stringContaining('expected USD, got EUR') as string,
    });
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.currency).toBe(USD);
    expect(capacity.repositories.ledger.movements).toHaveLength(movementsBefore);
    expect(capacity.repositories.treasuryMessages.byId.has('m-snapshot')).toBe(false);
  });

  it('should compare a listed reservation as of asOf, reading the client releases after it from the ledger (AC-43)', async () => {
    const capacity = await programHoldingInvoiceB();
    await releaseInvoiceB(capacity, AT_18_05, FIVE_HUNDRED_THOUSAND);

    await snapshotUseCase(capacity).execute(
      command({activeReservations: [{invoiceId: 'INV-B', heldAmount: ONE_POINT_NINE_MILLION}]}),
    );

    expect(invoiceB(capacity)?.held).toEqual(Money.of(140_000_000n, USD));
    expect(capacity.repositories.ledger.movements.at(-1)).toMatchObject({
      kind: 'adjustment',
      deltaHeld: -2_500_000n,
      attribution: {messageId: 'm-snapshot'},
      occurredAt: AT_18_10,
    });
  });

  it('should leave closed a listed reservation whose closing release came after asOf', async () => {
    const capacity = await programHoldingInvoiceB();
    await releaseInvoiceB(capacity, AT_18_05, null);

    const result = await snapshotUseCase(capacity).execute(
      command({activeReservations: [{invoiceId: 'INV-B', heldAmount: ONE_POINT_NINE_MILLION}]}),
    );

    expect(invoiceB(capacity)?.status).toBe('closed');
    expect(result).toEqual({
      outcome: 'applied',
      notes: [{kind: 'kept_closed_after_as_of', invoiceId: 'INV-B'}],
    });
  });

  it('should reopen a listed reservation closed by the client before asOf (AC-44)', async () => {
    const capacity = await programHoldingInvoiceB();
    await releaseInvoiceB(capacity, AT_12_00, null);

    await snapshotUseCase(capacity).execute(
      command({activeReservations: [{invoiceId: 'INV-B', heldAmount: ONE_POINT_NINE_MILLION}]}),
    );

    expect(invoiceB(capacity)?.status).toBe('active');
    expect(invoiceB(capacity)?.held).toEqual(Money.of(ONE_POINT_NINE_MILLION, USD));
  });

  it('should drop an omitted reservation and keep the reserved balance equal to the ledger (AC-27)', async () => {
    const capacity = await programHoldingInvoiceB();

    await snapshotUseCase(capacity).execute(command());

    expect(invoiceB(capacity)?.status).toBe('closed');
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(Money.zero(USD));
    expect(capacity.repositories.ledger.movements.at(-1)?.reservedAfter).toEqual(Money.zero(USD));
  });
});
