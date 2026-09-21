import {randomUUID} from 'node:crypto';
import {Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy} from '@nestjs/common';
import {
  currentCorrelationId,
  runWithCorrelationId,
} from '../../../../common/logging/correlation-id';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {InboundMessage, MESSAGE_SOURCE, MessageSource} from '../../../../messaging/message-source';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {parseCapacityUpdate} from './capacity-update-message.dto';
import {
  MESSAGE_ID_MAX_LENGTH,
  MESSAGE_TYPE_MAX_LENGTH,
  PROGRAM_ID_MAX_LENGTH,
} from '../../domain/identifier-limits';
import {readableString} from './readable-payload';
import {
  TREASURY_CONSUMER_GROUP,
  TREASURY_DEAD_LETTER_TOPIC,
  TREASURY_TOPIC,
} from './treasury-topics';

const CONTEXT = 'TreasuryCapacityConsumer';
const RESUBSCRIBE_AFTER_MS = 2_000;

type ParsedJson =
  {readonly ok: true; readonly payload: unknown} | {readonly ok: false; readonly error: string};

/**
 * Message handling for the treasury topic (CLAUDE.md §2): validate, map to a typed command, call
 * the use case. Malformed and unprocessable messages are recorded, dead-lettered and logged, and
 * consumption continues (A-13). Anything else, such as a database that is away, propagates so
 * the offset stays uncommitted and the message is delivered again.
 */
@Injectable()
export class TreasuryCapacityConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private stopped = false;
  private wakeUp: (() => void) | undefined;
  private starting: Promise<void> | undefined;

  constructor(
    @Inject(MESSAGE_SOURCE) private readonly source: MessageSource,
    private readonly applyCapacityUpdate: ApplyCapacityUpdate,
    private readonly rejectTreasuryMessage: RejectTreasuryMessage,
    private readonly logger: JsonLogger,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: a broker that is down at boot must not stall liveness and readiness. The
    // loop keeps trying until it subscribes or the application stops.
    this.starting = this.start();
  }

  async start(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.source.subscribe(TREASURY_TOPIC, TREASURY_CONSUMER_GROUP, (message) =>
          this.handle(message),
        );
        this.logger.log(`subscribed to ${TREASURY_TOPIC} as ${TREASURY_CONSUMER_GROUP}`, CONTEXT);
        return;
      } catch (reason: unknown) {
        const failure = reason instanceof Error ? reason.message : String(reason);
        this.logger.warn(`could not subscribe to ${TREASURY_TOPIC}, retrying: ${failure}`, CONTEXT);
        await this.pause();
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.wakeUp?.();
    await this.starting;
  }

  handle(message: InboundMessage): Promise<void> {
    const receivedAt = new Date();
    const parsed = parseJson(message.value);
    const messageId = parsed.ok ? readableMessageId(parsed.payload) : null;
    return runWithCorrelationId(messageId ?? randomUUID(), () =>
      this.process(message, parsed, messageId, receivedAt),
    );
  }

  private async process(
    message: InboundMessage,
    parsed: ParsedJson,
    messageId: string | null,
    receivedAt: Date,
  ): Promise<void> {
    this.logger.log(
      `received message ${message.topic}/${message.partition}/${message.offset}`,
      CONTEXT,
    );
    if (!parsed.ok) {
      return this.reject(message, {messageId, payload: null}, parsed.error, receivedAt);
    }

    const update = await parseCapacityUpdate(parsed.payload, receivedAt);
    if (!update.ok) {
      return this.reject(message, {messageId, payload: parsed.payload}, update.error, receivedAt);
    }

    const result = await this.applyCapacityUpdate.execute(update.command);
    if (result.outcome === 'rejected') {
      const error = `${result.reason}: ${result.error}`;
      return this.reject(message, {messageId, payload: parsed.payload}, error, receivedAt);
    }
    this.logger.log(`capacity update ${result.outcome} for ${update.command.programId}`, CONTEXT);
  }

  /**
   * Dead letter first, record second. If the publish fails the message is delivered again and
   * both steps run again; if the record fails the dead letter is published twice. Either way it
   * is never lost, which the other order could not promise (A-13).
   */
  private async reject(
    message: InboundMessage,
    readable: {messageId: string | null; payload: unknown},
    error: string,
    receivedAt: Date,
  ): Promise<void> {
    await this.deadLetter(message, error);
    if (readable.messageId !== null) {
      await this.rejectTreasuryMessage.execute({
        messageId: readable.messageId,
        programId: readableString(readable.payload, 'programId', PROGRAM_ID_MAX_LENGTH),
        type: readableString(readable.payload, 'type', MESSAGE_TYPE_MAX_LENGTH),
        payload: readable.payload,
        error,
        receivedAt,
      });
    }
    this.logger.warn(`message rejected: ${error}`, CONTEXT);
  }

  /** ADR-0003: the original bytes, with what went wrong and where it came from in the headers. */
  private deadLetter(message: InboundMessage, error: string): Promise<void> {
    return this.source.publish(TREASURY_DEAD_LETTER_TOPIC, [
      {
        key: message.key,
        value: message.value ?? Buffer.alloc(0),
        headers: {
          error,
          sourceTopic: message.topic,
          sourcePartition: String(message.partition),
          sourceOffset: message.offset,
          correlationId: currentCorrelationId() ?? 'unknown',
        },
      },
    ]);
  }

  /** Waits before the next attempt, or returns at once when the application is stopping. */
  private pause(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, RESUBSCRIBE_AFTER_MS);
      this.wakeUp = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}

const parseJson = (value: Buffer | null): ParsedJson => {
  if (value === null) return {ok: false, error: 'message has no value'};
  try {
    return {ok: true, payload: JSON.parse(value.toString('utf8'))};
  } catch (reason: unknown) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    return {ok: false, error: `message is not valid JSON: ${detail}`};
  }
};

const readableMessageId = (payload: unknown): string | null =>
  readableString(payload, 'messageId', MESSAGE_ID_MAX_LENGTH);
