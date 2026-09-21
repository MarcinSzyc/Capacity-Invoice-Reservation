import {randomUUID} from 'node:crypto';
import {Kafka, logLevel} from 'kafkajs';
import {JsonLogger} from '../common/logging/json-logger';
import {loadConfig} from '../config/configuration';
import {InboundMessage} from './message-source';
import {KafkaService} from './kafka.service';

const RECEIVE_TIMEOUT_MS = 30_000;

const uniqueName = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

const waitFor = async <T>(
  read: () => T | undefined | Promise<T | undefined>,
  what: string,
): Promise<T> => {
  const deadline = Date.now() + RECEIVE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${what} did not happen within ${RECEIVE_TIMEOUT_MS}ms`);
};

const readCommittedOffset = async (groupId: string, topic: string): Promise<string | undefined> => {
  const admin = new Kafka({
    clientId: 'offset-reader',
    brokers: (process.env.KAFKA_BROKERS ?? '').split(','),
    logLevel: logLevel.NOTHING,
  }).admin();
  await admin.connect();
  try {
    const [assignment] = await admin.fetchOffsets({groupId, topics: [topic]});
    const offset = assignment?.partitions[0]?.offset;
    return offset === '-1' ? undefined : offset;
  } finally {
    await admin.disconnect();
  }
};

describe('KafkaService', () => {
  let kafka: KafkaService;

  beforeAll(() => {
    kafka = new KafkaService(loadConfig(process.env), new JsonLogger());
  });

  afterAll(async () => {
    await kafka.onModuleDestroy();
  });

  it('should deliver a published message to a subscriber with its key, value and headers, then commit the offset', async () => {
    const topic = uniqueName('topic');
    const groupId = uniqueName('group');
    const received: InboundMessage[] = [];
    await kafka.subscribe(topic, groupId, (message) => {
      received.push(message);
      return Promise.resolve();
    });

    await kafka.publish(topic, [
      {key: 'PRG-1', value: '{"hello":"treasury"}', headers: {correlationId: 'c-1'}},
    ]);

    const message = await waitFor(() => received[0], 'the message');
    expect(message.topic).toBe(topic);
    expect(message.key).toBe('PRG-1');
    expect(message.value?.toString('utf8')).toBe('{"hello":"treasury"}');
    expect(message.headers).toEqual({correlationId: 'c-1'});
    expect(message.offset).toBe('0');

    const committed = await waitFor(() => readCommittedOffset(groupId, topic), 'the offset commit');
    expect(committed).toBe('1');
  });

  it('should not commit the offset of a message whose handler failed, so it is delivered again', async () => {
    const topic = uniqueName('topic');
    const groupId = uniqueName('group');
    const attempts: string[] = [];
    await kafka.subscribe(topic, groupId, (message) => {
      attempts.push(message.offset);
      if (attempts.length === 1) return Promise.reject(new Error('database is away'));
      return Promise.resolve();
    });

    await kafka.publish(topic, [{key: null, value: 'once'}]);

    await waitFor(() => (attempts.length >= 2 ? attempts : undefined), 'the redelivery');
    expect(attempts).toEqual(['0', '0']);
  });
});
