import {MemoryStream} from '../../../../../test/support/memory-stream';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {
  InboundMessage,
  MessageHandler,
  MessageSource,
  OutboundMessage,
} from '../../../../messaging/message-source';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {inMemoryCapacity} from '../../application/testing/in-memory-capacity.fake';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {TreasuryCapacityConsumer} from './treasury-capacity.consumer';
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
    const consumer = new TreasuryCapacityConsumer(
      source,
      new ApplyCapacityUpdate(capacity),
      new RejectTreasuryMessage(capacity),
      new JsonLogger(new MemoryStream()),
    );
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
    const consumer = new TreasuryCapacityConsumer(
      source,
      new ApplyCapacityUpdate(capacity),
      new RejectTreasuryMessage(capacity),
      new JsonLogger(new MemoryStream()),
    );
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
    const consumer = new TreasuryCapacityConsumer(
      source,
      new ApplyCapacityUpdate(capacity),
      new RejectTreasuryMessage(capacity),
      new JsonLogger(new MemoryStream()),
    );
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
});
