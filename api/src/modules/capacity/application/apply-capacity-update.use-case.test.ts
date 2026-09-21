import {Money} from '../domain/money';
import {Program} from '../domain/program';
import {ApplyCapacityUpdate, CapacityUpdateCommand} from './apply-capacity-update.use-case';
import {inMemoryCapacity} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-2';
const EUR = 'EUR';
const USD = 'USD';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_10_05 = new Date('2026-09-21T10:05:00.000Z');
const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');

const command = (overrides: Partial<CapacityUpdateCommand> = {}): CapacityUpdateCommand => ({
  messageId: 'm-1',
  programId: PROGRAM_ID,
  currency: EUR,
  creditLimit: 500_000_000n,
  eventTime: AT_10_00,
  payload: {messageId: 'm-1', type: 'capacity_update'},
  receivedAt: RECEIVED_AT,
  ...overrides,
});

describe('ApplyCapacityUpdate', () => {
  it('should create the program from the first update, append one limit_set movement and record the message as applied', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ApplyCapacityUpdate(capacity);

    const result = await useCase.execute(command());

    expect(result).toEqual({outcome: 'applied'});
    const program = capacity.repositories.programs.byId.get(PROGRAM_ID);
    expect(program?.limit).toEqual(Money.of(500_000_000n, EUR));
    expect(program?.available).toEqual(Money.of(500_000_000n, EUR));
    expect(capacity.repositories.ledger.movements).toHaveLength(1);
    expect(capacity.repositories.ledger.movements[0]?.attribution).toEqual({messageId: 'm-1'});
    expect(capacity.repositories.treasuryMessages.byId.get('m-1')).toMatchObject({
      outcome: 'applied',
      programId: PROGRAM_ID,
      type: 'capacity_update',
      duplicateCount: 0,
      receivedAt: RECEIVED_AT,
    });
  });

  it('should record a repeated messageId as duplicate and change nothing', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ApplyCapacityUpdate(capacity);
    await useCase.execute(command());

    const result = await useCase.execute(command({creditLimit: 1n, eventTime: AT_10_05}));

    expect(result).toEqual({outcome: 'duplicate'});
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.limit).toEqual(
      Money.of(500_000_000n, EUR),
    );
    expect(capacity.repositories.ledger.movements).toHaveLength(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-1')?.duplicateCount).toBe(1);
  });

  it('should keep the newer limit and record an older eventTime update as stale', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ApplyCapacityUpdate(capacity);
    await useCase.execute(
      command({messageId: 'm-1', creditLimit: 900_000_000n, eventTime: AT_10_05}),
    );

    const result = await useCase.execute(
      command({messageId: 'm-2', creditLimit: 800_000_000n, eventTime: AT_10_00}),
    );

    expect(result).toEqual({outcome: 'stale'});
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.limit).toEqual(
      Money.of(900_000_000n, EUR),
    );
    expect(capacity.repositories.ledger.movements).toHaveLength(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-2')?.outcome).toBe('stale');
  });

  it('should reject another currency on a program with something held, record it and change nothing (ADR-0007)', async () => {
    const capacity = inMemoryCapacity();
    await capacity.repositories.programs.save(
      Program.rehydrate({
        programId: PROGRAM_ID,
        currency: EUR,
        limit: Money.of(500_000_000n, EUR),
        reserved: Money.of(100n, EUR),
        limitEventTime: AT_10_00,
        asOf: null,
      }),
    );
    const useCase = new ApplyCapacityUpdate(capacity);

    const result = await useCase.execute(
      command({messageId: 'm-2', currency: USD, creditLimit: 1_000_000_000n, eventTime: AT_10_05}),
    );

    expect(result).toEqual({
      outcome: 'rejected',
      reason: 'CURRENCY_MISMATCH',
      error: expect.stringContaining('expected EUR, got USD') as string,
    });
    const program = capacity.repositories.programs.byId.get(PROGRAM_ID);
    expect(program?.currency).toBe(EUR);
    expect(program?.limit).toEqual(Money.of(500_000_000n, EUR));
    expect(capacity.repositories.ledger.movements).toHaveLength(0);
    expect(capacity.repositories.treasuryMessages.byId.get('m-2')).toMatchObject({
      outcome: 'rejected',
      error: expect.stringContaining('CURRENCY_MISMATCH') as string,
    });
  });

  it('should re-denominate a program with nothing held when the update carries another currency (ADR-0007)', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ApplyCapacityUpdate(capacity);
    await useCase.execute(command());

    const result = await useCase.execute(
      command({messageId: 'm-2', currency: USD, creditLimit: 1_000_000_000n, eventTime: AT_10_05}),
    );

    expect(result).toEqual({outcome: 'applied'});
    const program = capacity.repositories.programs.byId.get(PROGRAM_ID);
    expect(program?.currency).toBe(USD);
    expect(program?.available).toEqual(Money.of(1_000_000_000n, USD));
    expect(capacity.repositories.ledger.movements).toHaveLength(2);
  });
});
