import {Inject, Injectable, OnModuleDestroy} from '@nestjs/common';
import {
  Admin,
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaMessage,
  LogEntry,
  Message,
  Producer,
  logLevel,
} from 'kafkajs';
import {withoutCorrelationId} from '../common/logging/correlation-id';
import {JsonLogger} from '../common/logging/json-logger';
import {APP_CONFIG, AppConfig} from '../config/config.module';
import {InboundMessage, MessageHandler, MessageSource, OutboundMessage} from './message-source';

// Names this connection in the broker's logs. Consumer groups are chosen by the subscriber.
export const CLIENT_ID = 'capacity-service';

const CONTEXT = 'KafkaService';
// How long a fetch waits at the broker for data when the topic is idle. Shutdown waits for the
// fetch in flight, so the kafkajs default of five seconds is what a slow stop would cost.
const FETCH_MAX_WAIT_MS = 1_000;
const TOPIC_METADATA_ATTEMPTS = 50;
const TOPIC_METADATA_PAUSE_MS = 200;

/**
 * The one Kafka connection: readiness probes it, modules subscribe and publish through it
 * (ADR-0003). It never looks inside a message.
 */
@Injectable()
export class KafkaService implements MessageSource, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly admin: Admin;
  private readonly consumers: Consumer[] = [];
  private producer: Producer | undefined;

  constructor(
    @Inject(APP_CONFIG) config: Pick<AppConfig, 'kafkaBrokers'>,
    private readonly logger: JsonLogger,
  ) {
    this.kafka = new Kafka({
      clientId: CLIENT_ID,
      brokers: [...config.kafkaBrokers],
      // Errors go through our logger, so a readiness probe reporting `broker: down` leaves the
      // cause in the logs (A-18). Anything below a warning is kafkajs chatter we do not want.
      logLevel: logLevel.WARN,
      logCreator: () => (entry) => this.writeBrokerLog(entry),
    });
    this.admin = this.kafka.admin();
  }

  async isReachable(): Promise<boolean> {
    try {
      // kafkajs connect() is idempotent and owns its own state. Tracking it here as well went
      // wrong whenever a probe timed out: the stale continuation could flip the flag back.
      await this.admin.connect();
      await this.admin.listTopics();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Manual commits, one message at a time: the offset moves only after the handler has
   * returned, so the database transaction it ran is durable before the broker forgets the
   * message (ADR-0003). `fromBeginning` so that a message published before the first consumer
   * joined, such as the compose seed, is not skipped.
   */
  async subscribe(topic: string, groupId: string, handler: MessageHandler): Promise<void> {
    await this.ensureTopic(topic);
    const consumer = this.kafka.consumer({groupId, maxWaitTimeInMs: FETCH_MAX_WAIT_MS});
    this.consumers.push(consumer);
    await consumer.connect();
    await consumer.subscribe({topic, fromBeginning: true});
    await consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload): Promise<void> => {
        await handler(toInbound(payload));
        const offset = (BigInt(payload.message.offset) + 1n).toString();
        await consumer.commitOffsets([{topic, partition: payload.partition, offset}]);
      },
    });
  }

  async publish(topic: string, messages: readonly OutboundMessage[]): Promise<void> {
    const producer = await this.connectedProducer();
    await producer.send({topic, messages: messages.map(toOutbound)});
  }

  async onModuleDestroy(): Promise<void> {
    // Unconditional and tolerant: a probe may have timed out while connect() was still retrying,
    // and that loop keeps the process alive until every client is closed.
    await Promise.all([
      ...this.consumers.map((consumer) => quietly(() => consumer.disconnect())),
      quietly(() => this.producer?.disconnect() ?? Promise.resolve()),
      quietly(() => this.admin.disconnect()),
    ]);
  }

  private async connectedProducer(): Promise<Producer> {
    if (this.producer === undefined) this.producer = this.kafka.producer();
    await this.producer.connect();
    return this.producer;
  }

  /**
   * Subscribing to a topic nobody has written to yet fails on a broker without auto-creation and
   * races with the first write on one with it. Creating it up front makes the first boot on a
   * clean broker deterministic; an existing topic is left alone. The broker answers the create
   * before every node knows the topic, and kafkajs's own wait for leaders asks too early on a
   * fresh single node broker, so the wait is done here: metadata is polled until it lists the
   * topic.
   */
  private async ensureTopic(topic: string): Promise<void> {
    await this.admin.connect();
    const created = await this.admin.createTopics({topics: [{topic}], waitForLeaders: false});
    if (created) this.logger.log(`created topic ${topic}`, CONTEXT);
    await this.waitUntilTopicIsKnown(topic);
  }

  private async waitUntilTopicIsKnown(topic: string): Promise<void> {
    for (let attempt = 1; attempt <= TOPIC_METADATA_ATTEMPTS; attempt += 1) {
      if (await this.topicHasLeaders(topic)) return;
      await pause(TOPIC_METADATA_PAUSE_MS);
    }
    throw new Error(`topic ${topic} was created but the broker does not list it yet`);
  }

  private async topicHasLeaders(topic: string): Promise<boolean> {
    try {
      const {topics} = await this.admin.fetchTopicMetadata({topics: [topic]});
      const partitions = topics[0]?.partitions ?? [];
      return partitions.length > 0 && partitions.every((partition) => partition.leader >= 0);
    } catch {
      return false;
    }
  }

  private writeBrokerLog({level, log}: LogEntry): void {
    const message = `kafka: ${log.message}`;
    withoutCorrelationId(() => {
      if (level === logLevel.ERROR) {
        this.logger.error(message, undefined, CLIENT_ID);
        return;
      }
      this.logger.warn(message, CLIENT_ID);
    });
  }
}

const toOutbound = (message: OutboundMessage): Message => ({
  key: message.key,
  value: message.value,
  ...(message.headers === undefined ? {} : {headers: {...message.headers}}),
});

const toInbound = ({topic, partition, message}: EachMessagePayload): InboundMessage => ({
  topic,
  partition,
  offset: message.offset,
  key: message.key === null ? null : message.key.toString('utf8'),
  value: message.value,
  headers: stringHeaders(message.headers),
});

const stringHeaders = (headers: KafkaMessage['headers']): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value === undefined) continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) result[name] = first.toString();
  }
  return result;
};

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const quietly = async (close: () => Promise<void>): Promise<void> => {
  try {
    await close();
  } catch {
    // Shutting down. A client that never connected has nothing worth reporting here.
  }
};
