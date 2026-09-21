import {randomUUID} from 'node:crypto';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {PrismaService} from '../../../../persistence/prisma.service';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {PrismaLedgerRepository} from './prisma-ledger.repository';
import {PrismaProgramRepository} from './prisma-program.repository';
import {PrismaTreasuryMessageStore} from './prisma-treasury-message.store';
import {PrismaUnitOfWork} from './prisma-unit-of-work';

const EUR = 'EUR';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');
const FIVE_MILLION_EUR = Money.of(500_000_000n, EUR);

const uniqueId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

describe('Prisma capacity adapters', () => {
  let prisma: PrismaService;
  let unitOfWork: PrismaUnitOfWork;

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env), new JsonLogger());
    await prisma.onModuleInit();
    unitOfWork = new PrismaUnitOfWork(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('should save a program and read it back with the same balances, currency and times', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));

    await unitOfWork.run(({programs}) => programs.save(program));

    const read = await new PrismaProgramRepository(prisma).findById(programId);
    expect(read?.programId).toBe(programId);
    expect(read?.currency).toBe(EUR);
    expect(read?.limit).toEqual(FIVE_MILLION_EUR);
    expect(read?.reserved).toEqual(Money.zero(EUR));
    expect(read?.limitEventTime).toEqual(AT_10_00);
    expect(read?.asOf).toBeNull();
  });

  it('should answer null for a program the treasury never announced', async () => {
    await expect(new PrismaProgramRepository(prisma).findById('PRG-nobody')).resolves.toBeNull();
    await expect(
      unitOfWork.run(({programs}) => programs.lockById('PRG-nobody')),
    ).resolves.toBeNull();
  });

  it('should append a limit_set movement attributed to its message and read it back in order', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m');
    const program = Program.announce(programId, EUR);
    const outcome = program.setLimit(FIVE_MILLION_EUR, AT_10_00, messageId);
    if (outcome.kind !== 'applied') throw new Error('expected the first limit to apply');

    await unitOfWork.run(async ({programs, ledger}) => {
      await programs.save(program);
      await ledger.append(outcome.movement);
    });

    const rows = await new PrismaLedgerRepository(prisma).findByProgram(programId);
    expect(rows).toEqual([outcome.movement]);
  });

  it('should record a message outcome once and count every repetition on the same row', async () => {
    const messageId = uniqueId('m');
    const store = new PrismaTreasuryMessageStore(prisma);
    const record = {
      messageId,
      programId: 'PRG-1',
      type: 'capacity_update',
      payload: {messageId, creditLimit: 1},
      outcome: 'applied' as const,
      error: null,
      receivedAt: RECEIVED_AT,
    };

    await expect(store.wasProcessed(messageId)).resolves.toBe(false);
    await store.recordOutcome(record);
    await store.recordDuplicate(messageId);
    await store.recordDuplicate(messageId);

    await expect(store.wasProcessed(messageId)).resolves.toBe(true);
    expect(await store.findById(messageId)).toMatchObject({...record, duplicateCount: 2});
  });

  it('should roll back everything the work wrote when it throws', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));

    await expect(
      unitOfWork.run(async ({programs}) => {
        await programs.save(program);
        throw new Error('something after the write failed');
      }),
    ).rejects.toThrow('something after the write failed');

    await expect(new PrismaProgramRepository(prisma).findById(programId)).resolves.toBeNull();
  });

  it('should make a second unit of work wait for the row lock until the first commits', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));
    await unitOfWork.run(({programs}) => programs.save(program));
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstHolds = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = unitOfWork.run(async ({programs}) => {
      await programs.lockById(programId);
      order.push('first locked');
      await firstHolds;
      order.push('first done');
    });
    const second = unitOfWork.run(async ({programs}) => {
      await programs.lockById(programId);
      order.push('second locked');
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first locked', 'first done', 'second locked']);
  });
});
