import {MemoryStream} from '../../../../../test/support/memory-stream';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {
  InboundMessage,
  MessageHandler,
  MessageSource,
  OutboundMessage,
} from '../../../../messaging/message-source';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {ApplyReconciliationSnapshot} from '../../application/apply-reconciliation-snapshot.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {
  FixedClock,
  inMemoryCapacity,
  InMemoryUnitOfWork,
} from '../../application/testing/in-memory-capacity.fake';
import {Money} from '../../domain/money';
import {CapacityReads, CapacityRepositories, UnitOfWork} from '../../domain/ports/unit-of-work';
import {Program} from '../../domain/program';
import {ERROR_TEXT_MAX_LENGTH} from './readable-payload';
import {DEAD_LETTER_VALUE_MAX_BYTES, TreasuryCapacityConsumer} from './treasury-capacity.consumer';
import {TREASURY_DEAD_LETTER_TOPIC, TREASURY_TOPIC} from './treasury-topics';

const PROGRAM_ID = 'PRG-1';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');

/** A broker in memory whose publish can be told to fail, once. */
class FakeMessageSource implements MessageSource {
  readonly published: {topic: string; messages: readonly OutboundMessage[]}[] = [];
  failNextPublish = false;

  subscribe(_topic: string, _groupId: string, _handler: MessageHandler): Promise<void> {
    return Promise.resolve();
  }

  publish(topic: string, messages: readonly OutboundMessage[]): Promise<void> {
    if (this.failNextPublish) {
      this.failNextPublish = false;
      return Promise.reject(new Error('broker is away'));
    }
    this.published.push({topic, messages});
    return Promise.resolve();
  }
}

const inbound = (payload: unknown): InboundMessage => ({
  topic: TREASURY_TOPIC,
  partition: 0,
  offset: '7',
  key: PROGRAM_ID,
  value: Buffer.from(JSON.stringify(payload)),
  headers: {},
});

const KEEP_WINDOW_MS = 30_000;
// Deep enough to overflow the stack of class-transformer, found by review round 3 of S-06.
const NESTING = 5_000;
// Enough to make an unbounded validation error larger than the broker takes (review round 2 of S-08).
const MANY_UNKNOWN_FIELDS = 40_000;

const consumerFor = (
  capacity: InMemoryUnitOfWork,
  source: MessageSource,
  logs: MemoryStream = new MemoryStream(),
  applyCapacityUpdate: ApplyCapacityUpdate = new ApplyCapacityUpdate(capacity),
): TreasuryCapacityConsumer =>
  new TreasuryCapacityConsumer(
    source,
    applyCapacityUpdate,
    new ApplyReconciliationSnapshot(capacity, new FixedClock(AT_10_00), KEEP_WINDOW_MS),
    new RejectTreasuryMessage(capacity),
    new JsonLogger(logs),
  );

/**
 * A unit of work whose transactions fail a set number of times before they run, as a database
 * error would make them: a fake of the port, so the use case under it is the real one.
 */
class FailingUnitOfWork implements UnitOfWork {
  attempts = 0;

  constructor(
    private readonly inner: InMemoryUnitOfWork,
    private failuresLeft: number,
  ) {}

  run<T>(work: (repositories: CapacityRepositories) => Promise<T>): Promise<T> {
    this.attempts += 1;
    if (this.failuresLeft === 0) return this.inner.run(work);
    this.failuresLeft -= 1;
    return Promise.reject(new Error('value out of range for type bigint'));
  }

  readSnapshot<T>(work: (reads: CapacityReads) => Promise<T>): Promise<T> {
    return this.inner.readSnapshot(work);
  }
}

const failingUpdate = (
  capacity: InMemoryUnitOfWork,
  failures: number,
): {useCase: ApplyCapacityUpdate; unitOfWork: FailingUnitOfWork} => {
  const unitOfWork = new FailingUnitOfWork(capacity, failures);
  return {useCase: new ApplyCapacityUpdate(unitOfWork), unitOfWork};
};

const UPDATE = {
  messageId: 'm-limit',
  type: 'capacity_update',
  programId: PROGRAM_ID,
  currency: 'EUR',
  creditLimit: 500_000_000,
  eventTime: '2026-09-21T10:00:00.000Z',
};

const SNAPSHOT = {
  messageId: 'm-snapshot',
  type: 'reconciliation_snapshot',
  programId: PROGRAM_ID,
  currency: 'USD',
  creditLimit: 1_000_000_000,
  asOf: '2026-09-21T18:00:00.000Z',
  activeReservations: [{invoiceId: 'INV-Z', heldAmount: 0}],
};

const CURRENCY_CHANGE_ON_BUSY_PROGRAM = {
  messageId: 'm-usd',
  type: 'capacity_update',
  programId: PROGRAM_ID,
  currency: 'USD',
  creditLimit: 1_000_000_000,
  eventTime: '2026-09-21T10:05:00.000Z',
};

describe('TreasuryCapacityConsumer', () => {
  it('should dead-letter a rejected message before recording it, so a failed publish is retried and never lost', async () => {
    const capacity = inMemoryCapacity();
    await capacity.repositories.programs.save(
      Program.rehydrate({
        programId: PROGRAM_ID,
        currency: 'EUR',
        limit: Money.of(500_000_000n, 'EUR'),
        reserved: Money.of(100n, 'EUR'),
        limitEventTime: AT_10_00,
        asOf: null,
      }),
    );
    const source = new FakeMessageSource();
    const consumer = consumerFor(capacity, source);
    source.failNextPublish = true;

    await expect(consumer.handle(inbound(CURRENCY_CHANGE_ON_BUSY_PROGRAM))).rejects.toThrow(
      'broker is away',
    );
    expect(capacity.repositories.treasuryMessages.byId.has('m-usd')).toBe(false);

    await consumer.handle(inbound(CURRENCY_CHANGE_ON_BUSY_PROGRAM));

    expect(source.published).toHaveLength(1);
    expect(source.published[0]?.topic).toBe(TREASURY_DEAD_LETTER_TOPIC);
    expect(source.published[0]?.messages[0]?.headers?.error).toContain('CURRENCY_MISMATCH');
    expect(capacity.repositories.treasuryMessages.byId.get('m-usd')).toMatchObject({
      outcome: 'rejected',
      duplicateCount: 0,
    });
  });

  it('should count a malformed repeat of a known messageId as a duplicate and publish nothing (glossary: Duplicate)', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();
    const consumer = consumerFor(capacity, source);
    const malformed = {
      ...CURRENCY_CHANGE_ON_BUSY_PROGRAM,
      messageId: 'm-bad',
      creditLimit: 'a lot',
    };
    await consumer.handle(inbound(malformed));
    expect(source.published).toHaveLength(1);

    await consumer.handle(inbound(malformed));

    expect(source.published).toHaveLength(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')).toMatchObject({
      outcome: 'rejected',
      duplicateCount: 1,
    });
  });

  it('should dead-letter a malformed message before recording it, for the same reason', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();
    const consumer = consumerFor(capacity, source);
    const malformed = {
      ...CURRENCY_CHANGE_ON_BUSY_PROGRAM,
      messageId: 'm-bad',
      creditLimit: 'a lot',
    };
    source.failNextPublish = true;

    await expect(consumer.handle(inbound(malformed))).rejects.toThrow('broker is away');
    expect(capacity.repositories.treasuryMessages.byId.has('m-bad')).toBe(false);

    await consumer.handle(inbound(malformed));

    expect(source.published).toHaveLength(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')?.outcome).toBe('rejected');
  });

  it('should hand a reconciliation snapshot to its own use case by its type (A-11)', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();

    await consumerFor(capacity, source).handle(inbound(SNAPSHOT));

    const program = capacity.repositories.programs.byId.get(PROGRAM_ID);
    expect(program?.asOf).toEqual(new Date(SNAPSHOT.asOf));
    expect(program?.limit).toEqual(Money.of(1_000_000_000n, 'USD'));
    expect(capacity.repositories.treasuryMessages.byId.get('m-snapshot')).toMatchObject({
      outcome: 'applied',
      type: 'reconciliation_snapshot',
    });
    expect(source.published).toHaveLength(0);
  });

  it('should log every case where a snapshot was not followed, as its own event (ADR-0010)', async () => {
    const logs = new MemoryStream();

    await consumerFor(inMemoryCapacity(), new FakeMessageSource(), logs).handle(inbound(SNAPSHOT));

    expect(logs.lines()).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining('listed_with_nothing_held INV-Z') as string,
      }),
    );
  });

  it('should reject a message of a type the contract does not define and dead-letter it', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();

    await consumerFor(capacity, source).handle(inbound({...SNAPSHOT, type: 'limit_changed'}));

    expect(capacity.repositories.treasuryMessages.byId.get('m-snapshot')?.outcome).toBe('rejected');
    expect(source.published).toHaveLength(1);
  });

  it('should dead-letter a treasury message whose parsing throws and keep consuming', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();
    const consumer = consumerFor(capacity, source);
    const deeplyNested = (payload: object): InboundMessage => ({
      ...inbound(payload),
      value: Buffer.from(
        `${JSON.stringify(payload).slice(0, -1)},"extra":${'['.repeat(NESTING)}${']'.repeat(NESTING)}}`,
      ),
    });

    await consumer.handle(deeplyNested({...UPDATE, messageId: 'm-nested-update'}));
    await consumer.handle(deeplyNested({...SNAPSHOT, messageId: 'm-nested-snapshot'}));
    await consumer.handle(inbound(UPDATE));

    const {byId} = capacity.repositories.treasuryMessages;
    expect(byId.get('m-nested-update')?.outcome).toBe('rejected');
    expect(byId.get('m-nested-snapshot')?.outcome).toBe('rejected');
    expect(source.published.map(({topic}) => topic)).toEqual([
      TREASURY_DEAD_LETTER_TOPIC,
      TREASURY_DEAD_LETTER_TOPIC,
    ]);
    expect(byId.get('m-limit')?.outcome).toBe('applied');
  });

  it('should dead-letter a message with a bounded error, however many fields it refuses', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();
    const unknownFields = Object.fromEntries(
      Array.from({length: MANY_UNKNOWN_FIELDS}, (_, index) => [`k${index}`, 0]),
    );

    await consumerFor(capacity, source).handle(
      inbound({...UPDATE, messageId: 'm-wide', ...unknownFields}),
    );

    const error = source.published[0]?.messages[0]?.headers?.error;
    expect(typeof error === 'string' ? error.length : Infinity).toBeLessThanOrEqual(
      ERROR_TEXT_MAX_LENGTH,
    );
    expect(capacity.repositories.treasuryMessages.byId.get('m-wide')?.outcome).toBe('rejected');
  });

  it('should dead-letter a message too large to republish with its source position instead of its bytes', async () => {
    const capacity = inMemoryCapacity();
    const source = new FakeMessageSource();
    const oversized = {
      ...UPDATE,
      messageId: 'm-oversized',
      note: '0'.repeat(DEAD_LETTER_VALUE_MAX_BYTES),
    };

    await consumerFor(capacity, source).handle(inbound(oversized));

    const deadLetter = source.published[0]?.messages[0];
    expect(deadLetter?.value?.length).toBe(0);
    expect(deadLetter?.headers).toMatchObject({
      sourceOffset: '7',
      valueOmitted: expect.any(String) as string,
    });
    expect(capacity.repositories.treasuryMessages.byId.get('m-oversized')?.outcome).toBe(
      'rejected',
    );
  });

  it('should keep the original bytes of a dead letter that fits', async () => {
    const source = new FakeMessageSource();
    const malformed = {...UPDATE, messageId: 'm-small', creditLimit: 'a lot'};

    await consumerFor(inMemoryCapacity(), source).handle(inbound(malformed));

    const deadLetter = source.published[0]?.messages[0];
    expect(deadLetter?.value?.toString('utf8')).toBe(JSON.stringify(malformed));
    expect(deadLetter?.headers?.valueOmitted).toBeUndefined();
  });

  describe('a message whose handling fails (ADR-0013)', () => {
    it('should try again and apply the message when a later attempt succeeds', async () => {
      const capacity = inMemoryCapacity();
      const source = new FakeMessageSource();
      const failing = failingUpdate(capacity, 2);

      await consumerFor(capacity, source, new MemoryStream(), failing.useCase).handle(
        inbound(UPDATE),
      );

      expect(failing.unitOfWork.attempts).toBe(3);
      expect(capacity.repositories.treasuryMessages.byId.get('m-limit')?.outcome).toBe('applied');
      expect(source.published).toHaveLength(0);
    });

    it('should set a message aside after three failed attempts, keep the error and carry on with the next one', async () => {
      const capacity = inMemoryCapacity();
      const source = new FakeMessageSource();
      const logs = new MemoryStream();
      const failing = failingUpdate(capacity, 3);
      const consumer = consumerFor(capacity, source, logs, failing.useCase);

      await consumer.handle(inbound(UPDATE));
      await consumer.handle(inbound({...UPDATE, messageId: 'm-next'}));

      expect(failing.unitOfWork.attempts).toBe(4);
      expect(capacity.repositories.treasuryMessages.byId.get('m-limit')).toMatchObject({
        outcome: 'rejected',
        error: expect.stringContaining('value out of range for type bigint') as string,
      });
      expect(source.published).toHaveLength(1);
      expect(source.published[0]?.messages[0]?.headers).toMatchObject({
        error: expect.stringContaining('value out of range') as string,
      });
      expect(capacity.repositories.treasuryMessages.byId.get('m-next')?.outcome).toBe('applied');
      expect(capacity.repositories.treasuryMessages.failures).toEqual(
        [1, 2, 3].map((attempt) => ({
          messageId: 'm-limit',
          attempt,
          error: 'value out of range for type bigint',
          failedAt: expect.any(Date) as Date,
        })),
      );
      expect(logs.lines()).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: expect.stringContaining('m-limit') as string,
        }),
      );
    });

    it('should leave the message for redelivery when setting it aside fails too, so an outage loses nothing', async () => {
      const capacity = inMemoryCapacity();
      const source = new FakeMessageSource();
      source.failNextPublish = true;
      const consumer = consumerFor(
        capacity,
        source,
        new MemoryStream(),
        failingUpdate(capacity, 3).useCase,
      );

      await expect(consumer.handle(inbound(UPDATE))).rejects.toThrow('broker is away');

      expect(capacity.repositories.treasuryMessages.byId.has('m-limit')).toBe(false);
    });
  });
});
