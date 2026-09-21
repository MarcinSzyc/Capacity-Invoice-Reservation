import {randomUUID} from 'node:crypto';
import {MemoryStream} from '../../../../../test/support/memory-stream';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {KafkaService} from '../../../../messaging/kafka.service';
import {InboundMessage} from '../../../../messaging/message-source';
import {PrismaService} from '../../../../persistence/prisma.service';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {PrismaLedgerRepository} from '../persistence/prisma-ledger.repository';
import {PrismaProgramRepository} from '../persistence/prisma-program.repository';
import {
  PrismaTreasuryMessageStore,
  StoredTreasuryMessage,
} from '../persistence/prisma-treasury-message.store';
import {PrismaUnitOfWork} from '../persistence/prisma-unit-of-work';
import {DevTreasuryProducer} from './dev-treasury-producer';
import {TreasuryCapacityConsumer} from './treasury-capacity.consumer';
import {TREASURY_DEAD_LETTER_TOPIC, TREASURY_TOPIC} from './treasury-topics';

const EUR = 'EUR';
const USD = 'USD';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_10_05 = new Date('2026-09-21T10:05:00.000Z');
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');
const NINE_MILLION = 900_000_000n;
const EIGHT_MILLION = 800_000_000n;
const FIVE_MILLION = 500_000_000n;
const TEN_MILLION = 1_000_000_000n;
const WAIT_MS = 30_000;

const uniqueId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

const waitFor = async <T>(read: () => Promise<T | undefined>, what: string): Promise<T> => {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${what} did not happen within ${WAIT_MS}ms`);
};

describe('TreasuryCapacityConsumer', () => {
  let prisma: PrismaService;
  let kafka: KafkaService;
  let logs: MemoryStream;
  let producer: DevTreasuryProducer;
  let programs: PrismaProgramRepository;
  let ledger: PrismaLedgerRepository;
  let messages: PrismaTreasuryMessageStore;
  const deadLetters: InboundMessage[] = [];

  beforeAll(async () => {
    const config = loadConfig(process.env);
    logs = new MemoryStream();
    const logger = new JsonLogger(logs);
    prisma = new PrismaService(config, logger);
    await prisma.onModuleInit();
    kafka = new KafkaService(config, logger);
    const unitOfWork = new PrismaUnitOfWork(prisma);
    programs = new PrismaProgramRepository(prisma);
    ledger = new PrismaLedgerRepository(prisma);
    messages = new PrismaTreasuryMessageStore(prisma);
    producer = new DevTreasuryProducer(kafka);

    const consumer = new TreasuryCapacityConsumer(
      kafka,
      new ApplyCapacityUpdate(unitOfWork),
      new RejectTreasuryMessage(unitOfWork),
      logger,
    );
    await consumer.start();
    await kafka.subscribe(TREASURY_DEAD_LETTER_TOPIC, uniqueId('dlq-reader'), (message) => {
      deadLetters.push(message);
      return Promise.resolve();
    });
  });

  afterAll(async () => {
    await kafka.onModuleDestroy();
    await prisma.onModuleDestroy();
  });

  const outcomeOf = (messageId: string): Promise<StoredTreasuryMessage> =>
    waitFor(
      async () => (await messages.findById(messageId)) ?? undefined,
      `outcome of ${messageId}`,
    );

  const duplicateOf = (messageId: string): Promise<StoredTreasuryMessage> =>
    waitFor(async () => {
      const stored = await messages.findById(messageId);
      return stored !== null && stored.duplicateCount > 0 ? stored : undefined;
    }, `duplicate count on ${messageId}`);

  const deadLetterOf = (messageId: string): Promise<InboundMessage> =>
    waitFor(
      () =>
        Promise.resolve(
          deadLetters.find((message) =>
            (message.value?.toString('utf8') ?? '').includes(messageId),
          ),
        ),
      `dead letter of ${messageId}`,
    );

  it('[AC-23] should record a repeated messageId as duplicate and change nothing', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m');
    const update = {
      messageId,
      programId,
      currency: EUR,
      creditLimit: FIVE_MILLION,
      eventTime: AT_10_00,
    };

    await producer.publishCapacityUpdate(update);
    await producer.publishCapacityUpdate({...update, creditLimit: 1n, eventTime: AT_10_05});

    const stored = await duplicateOf(messageId);
    expect(stored).toMatchObject({outcome: 'applied', duplicateCount: 1, programId});
    const program = await programs.findById(programId);
    expect(program?.limit).toEqual(Money.of(FIVE_MILLION, EUR));
    expect(program?.limitEventTime).toEqual(AT_10_00);
    const movements = await ledger.findByProgram(programId);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.kind).toBe('limit_set');
  });

  it('[AC-24] should keep the newer limit and record an older eventTime update as stale', async () => {
    const programId = uniqueId('PRG');
    const newer = uniqueId('m');
    const older = uniqueId('m');

    await producer.publishCapacityUpdate({
      messageId: newer,
      programId,
      currency: EUR,
      creditLimit: NINE_MILLION,
      eventTime: AT_10_05,
    });
    await producer.publishCapacityUpdate({
      messageId: older,
      programId,
      currency: EUR,
      creditLimit: EIGHT_MILLION,
      eventTime: AT_10_00,
    });

    expect(await outcomeOf(older)).toMatchObject({outcome: 'stale', programId});
    expect(await outcomeOf(newer)).toMatchObject({outcome: 'applied'});
    const program = await programs.findById(programId);
    expect(program?.limit).toEqual(Money.of(NINE_MILLION, EUR));
    expect(program?.limitEventTime).toEqual(AT_10_05);
    expect(await ledger.findByProgram(programId)).toHaveLength(1);
  });

  it('[AC-25] should dead-letter a malformed message, log it and apply the next valid one', async () => {
    const programId = uniqueId('PRG');
    const malformedId = uniqueId('m-bad');
    const validId = uniqueId('m');
    const malformed = {
      messageId: malformedId,
      type: 'capacity_update',
      programId,
      currency: EUR,
      creditLimit: 'a lot',
      eventTime: AT_10_00.toISOString(),
    };

    await kafka.publish(TREASURY_TOPIC, [{key: programId, value: JSON.stringify(malformed)}]);
    await producer.publishCapacityUpdate({
      messageId: validId,
      programId,
      currency: EUR,
      creditLimit: FIVE_MILLION,
      eventTime: AT_10_05,
    });

    expect(await outcomeOf(validId)).toMatchObject({outcome: 'applied'});
    expect((await programs.findById(programId))?.limit).toEqual(Money.of(FIVE_MILLION, EUR));

    const rejected = await outcomeOf(malformedId);
    expect(rejected).toMatchObject({
      outcome: 'rejected',
      programId,
      type: 'capacity_update',
      payload: malformed,
      error: expect.stringContaining('creditLimit') as string,
    });

    const deadLetter = await deadLetterOf(malformedId);
    expect(deadLetter.key).toBe(programId);
    expect(JSON.parse(deadLetter.value?.toString('utf8') ?? '')).toEqual(malformed);
    expect(deadLetter.headers).toMatchObject({
      error: expect.stringContaining('creditLimit') as string,
      sourceTopic: TREASURY_TOPIC,
      sourcePartition: expect.any(String) as string,
      sourceOffset: expect.any(String) as string,
      correlationId: malformedId,
    });

    const lines = logs.lines().filter((line) => line.correlationId === malformedId);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.some((line) => line.level === 'warn')).toBe(true);
  });

  it('should re-denominate a program with nothing held and dead-letter a currency change on one with something held (ADR-0007)', async () => {
    const emptyProgram = uniqueId('PRG');
    const busyProgram = uniqueId('PRG');
    const onEmpty = uniqueId('m');
    const onBusy = uniqueId('m');
    await programs.save(
      Program.rehydrate({
        programId: busyProgram,
        currency: EUR,
        limit: Money.of(FIVE_MILLION, EUR),
        reserved: Money.of(100n, EUR),
        limitEventTime: AT_10_00,
        asOf: null,
      }),
    );
    await producer.publishCapacityUpdate({
      messageId: uniqueId('m'),
      programId: emptyProgram,
      currency: EUR,
      creditLimit: FIVE_MILLION,
      eventTime: AT_10_00,
    });

    await producer.publishCapacityUpdate({
      messageId: onEmpty,
      programId: emptyProgram,
      currency: USD,
      creditLimit: TEN_MILLION,
      eventTime: AT_10_05,
    });
    await producer.publishCapacityUpdate({
      messageId: onBusy,
      programId: busyProgram,
      currency: USD,
      creditLimit: TEN_MILLION,
      eventTime: AT_10_10,
    });

    expect(await outcomeOf(onEmpty)).toMatchObject({outcome: 'applied'});
    const redenominated = await programs.findById(emptyProgram);
    expect(redenominated?.currency).toBe(USD);
    expect(redenominated?.available).toEqual(Money.of(TEN_MILLION, USD));

    expect(await outcomeOf(onBusy)).toMatchObject({
      outcome: 'rejected',
      error: expect.stringContaining('CURRENCY_MISMATCH') as string,
    });
    const untouched = await programs.findById(busyProgram);
    expect(untouched?.currency).toBe(EUR);
    expect(untouched?.limit).toEqual(Money.of(FIVE_MILLION, EUR));
    expect((await deadLetterOf(onBusy)).headers.error).toContain('CURRENCY_MISMATCH');
  });

  it('should reject a message type it does not know yet, such as a snapshot before S-06 defines it', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m-snap');
    const snapshot = {
      messageId,
      type: 'reconciliation_snapshot',
      programId,
      currency: EUR,
      creditLimit: 700_000_000,
      asOf: AT_10_00.toISOString(),
      activeReservations: [],
    };

    await kafka.publish(TREASURY_TOPIC, [{key: programId, value: JSON.stringify(snapshot)}]);

    expect(await outcomeOf(messageId)).toMatchObject({
      outcome: 'rejected',
      type: 'reconciliation_snapshot',
      error: expect.stringContaining('type') as string,
    });
    await expect(programs.findById(programId)).resolves.toBeNull();
    expect((await deadLetterOf(messageId)).headers.correlationId).toBe(messageId);
  });

  it('should dead-letter a message that is not JSON and carry on', async () => {
    const marker = uniqueId('not-json');
    const programId = uniqueId('PRG');
    const validId = uniqueId('m');

    await kafka.publish(TREASURY_TOPIC, [{key: programId, value: `${marker} <not json>`}]);
    await producer.publishCapacityUpdate({
      messageId: validId,
      programId,
      currency: EUR,
      creditLimit: FIVE_MILLION,
      eventTime: AT_10_00,
    });

    expect(await outcomeOf(validId)).toMatchObject({outcome: 'applied'});
    const deadLetter = await deadLetterOf(marker);
    expect(deadLetter.headers.error).toMatch(/JSON/);
  });
});
