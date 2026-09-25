import {randomUUID} from 'node:crypto';
import {MemoryStream} from '../../../../../test/support/memory-stream';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {KafkaService} from '../../../../messaging/kafka.service';
import {InboundMessage} from '../../../../messaging/message-source';
import {PrismaService} from '../../../../persistence/prisma.service';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {ApplyReconciliationSnapshot} from '../../application/apply-reconciliation-snapshot.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {Money} from '../../domain/money';
import {ReserveCapacity} from '../../application/reserve-capacity.use-case';
import {SeededRandom} from '../../domain/testing/seeded-random';
import {PrismaReservationRepository} from '../persistence/prisma-reservation.repository';
import {Program} from '../../domain/program';
import {PrismaLedgerRepository} from '../persistence/prisma-ledger.repository';
import {PrismaProgramRepository} from '../persistence/prisma-program.repository';
import {
  PrismaTreasuryMessageStore,
  StoredTreasuryMessage,
} from '../persistence/prisma-treasury-message.store';
import {PrismaUnitOfWork} from '../persistence/prisma-unit-of-work';
import {SystemClock} from '../system-clock';
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
const FIVE_MILLION_EUR = Money.of(FIVE_MILLION, EUR);
const WAIT_MS = 30_000;
const KEEP_WINDOW_MS = 30_000;

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
  let reservations: PrismaReservationRepository;
  let reserve: ReserveCapacity;
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
    reservations = new PrismaReservationRepository(prisma);
    reserve = new ReserveCapacity(unitOfWork, new SystemClock());
    producer = new DevTreasuryProducer(kafka);

    const consumer = new TreasuryCapacityConsumer(
      kafka,
      new ApplyCapacityUpdate(unitOfWork),
      new ApplyReconciliationSnapshot(unitOfWork, new SystemClock(), KEEP_WINDOW_MS),
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

  it('should reject a message type the contract does not define (A-11)', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m-snap');
    const snapshot = {
      messageId,
      type: 'limit_changed',
      programId,
      currency: EUR,
      creditLimit: 700_000_000,
      asOf: AT_10_00.toISOString(),
      activeReservations: [],
    };

    await kafka.publish(TREASURY_TOPIC, [{key: programId, value: JSON.stringify(snapshot)}]);

    expect(await outcomeOf(messageId)).toMatchObject({
      outcome: 'rejected',
      type: 'limit_changed',
      error: expect.stringContaining('type') as string,
    });
    await expect(programs.findById(programId)).resolves.toBeNull();
    expect((await deadLetterOf(messageId)).headers.correlationId).toBe(messageId);
  });

  it('should dead-letter a message whose messageId does not fit the store and apply the next valid one', async () => {
    const programId = uniqueId('PRG');
    const marker = uniqueId('too-long');
    const overlongId = `${marker}-${'x'.repeat(128)}`;
    const validId = uniqueId('m');

    await kafka.publish(TREASURY_TOPIC, [
      {
        key: programId,
        value: JSON.stringify({
          messageId: overlongId,
          type: 'capacity_update',
          programId,
          currency: EUR,
          creditLimit: 1,
          eventTime: AT_10_00.toISOString(),
        }),
      },
    ]);
    await producer.publishCapacityUpdate({
      messageId: validId,
      programId,
      currency: EUR,
      creditLimit: FIVE_MILLION,
      eventTime: AT_10_05,
    });

    expect(await outcomeOf(validId)).toMatchObject({outcome: 'applied'});
    const deadLetter = await deadLetterOf(marker);
    expect(deadLetter.headers.error).toContain('messageId');
    expect(deadLetter.headers.correlationId).not.toBe(overlongId);
    await expect(messages.findById(overlongId)).resolves.toBeNull();
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

  describe('reconciliation snapshots', () => {
    const AT = (hour: number): Date => new Date(Date.UTC(2026, 8, 21, hour));
    const SEVEN_MILLION = 700_000_000n;
    const SEVEN_HUNDRED_THOUSAND = 70_000_000n;

    const snapshotOf = (
      programId: string,
      overrides: Partial<Parameters<DevTreasuryProducer['publishSnapshot']>[0]> = {},
    ): Parameters<DevTreasuryProducer['publishSnapshot']>[0] => ({
      messageId: uniqueId('m-snap'),
      programId,
      currency: USD,
      creditLimit: TEN_MILLION,
      asOf: AT(18),
      activeReservations: [],
      ...overrides,
    });

    it('[AC-30] should ignore a snapshot older than the last applied one and record it as stale', async () => {
      const programId = uniqueId('PRG');
      const newer = snapshotOf(programId, {
        asOf: AT(18),
        activeReservations: [{invoiceId: 'INV-X', heldAmount: SEVEN_HUNDRED_THOUSAND}],
      });
      const older = snapshotOf(programId, {asOf: AT(12), creditLimit: SEVEN_MILLION});

      await producer.publishSnapshot(newer);
      expect(await outcomeOf(newer.messageId)).toMatchObject({outcome: 'applied'});
      const ledgerBefore = await ledger.findByProgram(programId);
      await producer.publishSnapshot(older);

      expect(await outcomeOf(older.messageId)).toMatchObject({
        outcome: 'stale',
        type: 'reconciliation_snapshot',
        programId,
      });
      const program = await programs.findById(programId);
      expect(program?.limit).toEqual(Money.of(TEN_MILLION, USD));
      expect(program?.asOf).toEqual(AT(18));
      expect(await ledger.findByProgram(programId)).toEqual(ledgerBefore);
    });

    it('should dead-letter a snapshot whose currency differs while a reservation is active (ADR-0007)', async () => {
      const programId = uniqueId('PRG');
      const limit = uniqueId('m');
      await producer.publishCapacityUpdate({
        messageId: limit,
        programId,
        currency: USD,
        creditLimit: TEN_MILLION,
        eventTime: AT_10_00,
      });
      await outcomeOf(limit);
      await reserve.execute({
        programId,
        invoiceId: 'INV-A',
        invoiceAmount: SEVEN_HUNDRED_THOUSAND,
        invoiceCurrency: USD,
        rate: null,
        clientId: 'client-contract',
      });
      const inEuro = snapshotOf(programId, {currency: EUR});

      await producer.publishSnapshot(inEuro);

      expect(await outcomeOf(inEuro.messageId)).toMatchObject({
        outcome: 'rejected',
        error: expect.stringContaining('CURRENCY_MISMATCH') as string,
      });
      expect((await deadLetterOf(inEuro.messageId)).key).toBe(programId);
      const program = await programs.findById(programId);
      expect(program?.currency).toBe(USD);
      expect(program?.asOf).toBeNull();
      expect((await reservations.findByInvoice(programId, 'INV-A'))?.status).toBe('active');
    });

    it('should re-denominate an empty program from a snapshot in another currency (ADR-0007)', async () => {
      const programId = uniqueId('PRG');
      const inDollars = snapshotOf(programId, {asOf: AT(12)});
      const inEuro = snapshotOf(programId, {
        currency: EUR,
        creditLimit: FIVE_MILLION,
        activeReservations: [{invoiceId: 'INV-X', heldAmount: SEVEN_HUNDRED_THOUSAND}],
      });

      await producer.publishSnapshot(inDollars);
      await producer.publishSnapshot(inEuro);

      expect(await outcomeOf(inEuro.messageId)).toMatchObject({outcome: 'applied'});
      const program = await programs.findById(programId);
      expect(program?.currency).toBe(EUR);
      expect(program?.limit).toEqual(FIVE_MILLION_EUR);
      expect(program?.reserved).toEqual(Money.of(SEVEN_HUNDRED_THOUSAND, EUR));
    });

    it('should reject a snapshot that lists one invoice twice', async () => {
      const programId = uniqueId('PRG');
      const messageId = uniqueId('m-snap');
      const twice = {
        messageId,
        type: 'reconciliation_snapshot',
        programId,
        currency: USD,
        creditLimit: 1_000_000_000,
        asOf: AT(18).toISOString(),
        activeReservations: [
          {invoiceId: 'INV-X', heldAmount: 1},
          {invoiceId: 'INV-X', heldAmount: 2},
        ],
      };

      await kafka.publish(TREASURY_TOPIC, [{key: programId, value: JSON.stringify(twice)}]);

      expect(await outcomeOf(messageId)).toMatchObject({
        outcome: 'rejected',
        error: expect.stringContaining('activeReservations') as string,
      });
      await deadLetterOf(messageId);
      await expect(programs.findById(programId)).resolves.toBeNull();
    });

    /**
     * Five capacity updates and three snapshots for one program. `INV-X` is listed by the first
     * snapshot, omitted by the second and listed again by the third, which is the sequence that
     * needs ADR-0012's reopen for INV-07 to hold.
     */
    type Fact = (programId: string) => Promise<string>;
    const update =
      (hour: number, creditLimit: bigint): Fact =>
      async (programId) => {
        const messageId = uniqueId('m-upd');
        await producer.publishCapacityUpdate({
          messageId,
          programId,
          currency: USD,
          creditLimit,
          eventTime: AT(hour),
        });
        return messageId;
      };
    const snapshot =
      (hour: number, creditLimit: bigint, listed: Record<string, bigint>): Fact =>
      async (programId) => {
        const published = snapshotOf(programId, {
          asOf: AT(hour),
          creditLimit,
          activeReservations: Object.entries(listed).map(([invoiceId, heldAmount]) => ({
            invoiceId,
            heldAmount,
          })),
        });
        await producer.publishSnapshot(published);
        return published.messageId;
      };
    const FACTS: readonly Fact[] = [
      update(10, 500_000_000n),
      snapshot(11, 600_000_000n, {'INV-X': 70_000_000n, 'INV-Y': 30_000_000n}),
      update(12, 800_000_000n),
      snapshot(13, 700_000_000n, {'INV-Y': 25_000_000n}),
      update(14, 900_000_000n),
      update(15, 400_000_000n),
      snapshot(16, 750_000_000n, {'INV-X': 50_000_000n, 'INV-Y': 25_000_000n}),
      update(17, 1_000_000_000n),
    ];

    const shuffled = <T>(items: readonly T[], seed: number): T[] => {
      const random = new SeededRandom(seed);
      const result = [...items];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random.next() * (index + 1));
        [result[index], result[other]] = [result[other] as T, result[index] as T];
      }
      return result;
    };

    /** S-06 local decision 12: state, not history. Birth details and the ledger may differ. */
    const finalStateAfter = async (order: readonly Fact[]): Promise<unknown> => {
      const programId = uniqueId('PRG');
      const messageIds: string[] = [];
      for (const fact of order) messageIds.push(await fact(programId));
      for (const messageId of messageIds) await outcomeOf(messageId);

      const program = await programs.findById(programId);
      const listed = await reservations.findByInvoices(programId, ['INV-X', 'INV-Y']);
      return {
        currency: program?.currency,
        limit: program?.limit.amount,
        limitEventTime: program?.limitEventTime,
        asOf: program?.asOf,
        reserved: program?.reserved.amount,
        available: program?.available.amount,
        reservations: listed.map((r) => ({
          invoiceId: r.invoiceId,
          held: r.held.amount,
          status: r.status,
          source: r.source,
        })),
      };
    };

    it('[INV-07] should reach the same final state for shuffled and reversed message order as for in-order delivery', async () => {
      const inOrder = await finalStateAfter(FACTS);

      expect(inOrder).toEqual({
        currency: USD,
        limit: 1_000_000_000n,
        limitEventTime: AT(17),
        asOf: AT(16),
        reserved: 75_000_000n,
        available: 925_000_000n,
        reservations: [
          {invoiceId: 'INV-X', held: 50_000_000n, status: 'active', source: 'reconciliation'},
          {invoiceId: 'INV-Y', held: 25_000_000n, status: 'active', source: 'reconciliation'},
        ],
      });
      expect(await finalStateAfter([...FACTS].reverse())).toEqual(inOrder);
      for (const seed of [7, 42, 2026]) {
        expect(await finalStateAfter(shuffled(FACTS, seed))).toEqual(inOrder);
      }
    });
  });
});
