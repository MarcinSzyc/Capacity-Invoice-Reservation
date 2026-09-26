import {randomUUID} from 'node:crypto';
import {Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy} from '@nestjs/common';
import {
  currentCorrelationId,
  runWithCorrelationId,
} from '../../../../common/logging/correlation-id';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {InboundMessage, MESSAGE_SOURCE, MessageSource} from '../../../../messaging/message-source';
import {ApplyCapacityUpdate} from '../../application/apply-capacity-update.use-case';
import {
  ApplyReconciliationSnapshot,
  RECONCILIATION_SNAPSHOT_TYPE,
} from '../../application/apply-reconciliation-snapshot.use-case';
import {RejectTreasuryMessage} from '../../application/reject-treasury-message.use-case';
import {ReconciliationNote} from '../../domain/reconciliation';
import {parseCapacityUpdate} from './capacity-update-message.dto';
import {parseReconciliationSnapshot} from './reconciliation-snapshot-message.dto';
import {
  MESSAGE_ID_MAX_LENGTH,
  MESSAGE_TYPE_MAX_LENGTH,
  PROGRAM_ID_MAX_LENGTH,
} from '../../domain/identifier-limits';
import {readableString, storablePayload, storableText} from './readable-payload';
import {
  TREASURY_CONSUMER_GROUP,
  TREASURY_DEAD_LETTER_TOPIC,
  TREASURY_TOPIC,
} from './treasury-topics';

const CONTEXT = 'TreasuryCapacityConsumer';
const RESUBSCRIBE_AFTER_MS = 2_000;
// ADR-0013: a message is tried this many times in one delivery before it is set aside.
const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 250;
/**
 * The largest dead letter value republished as is. Kafka's default `message.max.bytes` is 1 MiB,
 * and the value arrives decompressed while the dead letter goes out uncompressed, so a message
 * the broker took from the treasury can be one it refuses from us (review round 3 of S-08).
 * Below the default with room for the bounded headers.
 */
export const DEAD_LETTER_VALUE_MAX_BYTES = 1_000_000;
/**
 * The largest dead letter key republished as is. A treasury key is a program id; a key that is
 * not UTF-8 comes back three bytes per byte, and a long one next to a value at its bound would
 * push the dead letter past the broker's limit (review round 4 of S-08).
 */
export const DEAD_LETTER_KEY_MAX_BYTES = 1_000;

type Attempted<T> =
  {readonly ok: true; readonly value: T} | {readonly ok: false; readonly error: string};

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
    private readonly applyReconciliationSnapshot: ApplyReconciliationSnapshot,
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
    // A-11: two message types on one topic. Anything that is not a snapshot is judged as a
    // capacity update, whose `type` check refuses whatever the contract does not define.
    const type = readableString(parsed.payload, 'type', MESSAGE_TYPE_MAX_LENGTH);
    if (type === RECONCILIATION_SNAPSHOT_TYPE) {
      return this.processSnapshot(message, parsed.payload, messageId, receivedAt);
    }

    const update = await parsedOrRefused(() => parseCapacityUpdate(parsed.payload, receivedAt));
    if (!update.ok) {
      return this.reject(message, {messageId, payload: parsed.payload}, update.error, receivedAt);
    }

    const readable = {messageId, payload: parsed.payload};
    const attempted = await this.attempted(update.command.messageId, () =>
      this.applyCapacityUpdate.execute(update.command),
    );
    if (!attempted.ok) return this.setAside(message, readable, attempted.error, receivedAt);
    const result = attempted.value;
    if (result.outcome === 'rejected') {
      const error = `${result.reason}: ${result.error}`;
      return this.reject(message, {messageId, payload: parsed.payload}, error, receivedAt);
    }
    this.logger.log(`capacity update ${result.outcome} for ${update.command.programId}`, CONTEXT);
  }

  private async processSnapshot(
    message: InboundMessage,
    payload: unknown,
    messageId: string | null,
    receivedAt: Date,
  ): Promise<void> {
    const snapshot = await parsedOrRefused(() => parseReconciliationSnapshot(payload, receivedAt));
    if (!snapshot.ok) return this.reject(message, {messageId, payload}, snapshot.error, receivedAt);

    const {programId} = snapshot.command;
    const attempted = await this.attempted(snapshot.command.messageId, () =>
      this.applyReconciliationSnapshot.execute(snapshot.command),
    );
    if (!attempted.ok) {
      return this.setAside(message, {messageId, payload}, attempted.error, receivedAt);
    }
    const result = attempted.value;
    if (result.outcome === 'rejected') {
      const error = `${result.reason}: ${result.error}`;
      return this.reject(message, {messageId, payload}, error, receivedAt);
    }
    if (result.outcome === 'applied') {
      for (const note of result.notes) this.logger.warn(describeNote(programId, note), CONTEXT);
    }
    this.logger.log(`reconciliation snapshot ${result.outcome} for ${programId}`, CONTEXT);
  }

  /**
   * ADR-0013: an error while applying is tried again, up to `ATTEMPTS` in all. Each attempt is its
   * own transaction, so a failed one leaves nothing behind.
   */
  private async attempted<T>(messageId: string, work: () => Promise<T>): Promise<Attempted<T>> {
    let failure = '';
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        return {ok: true, value: await work()};
      } catch (reason: unknown) {
        failure = reason instanceof Error ? reason.message : String(reason);
        this.logger.warn(`message ${messageId} failed attempt ${attempt}: ${failure}`, CONTEXT);
        await this.keepFailure(messageId, attempt, failure);
      }
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
    return {ok: false, error: failure};
  }

  /** Best effort: when the database is what is failing, the log line above is all there is. */
  private async keepFailure(messageId: string, attempt: number, error: string): Promise<void> {
    try {
      await this.rejectTreasuryMessage.recordFailure({
        messageId,
        attempt,
        error: storableText(error),
        failedAt: new Date(),
      });
    } catch (reason: unknown) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      this.logger.warn(`could not keep failure of ${messageId}: ${detail}`, CONTEXT);
    }
  }

  /**
   * ADR-0013: after the last attempt the message is a rejection like any other: dead-lettered with
   * the error, recorded, and consumption continues. If the broker or the database is away when
   * the dead letter or the record is written, `reject` throws, the offset stays uncommitted and
   * the message is delivered again, so an outage delays messages rather than setting them aside.
   * What a store would refuse every time is shaped before it gets there (bounded error, storable
   * payload and ids, a dead letter key and value within the broker's size), so only an outage
   * throws.
   */
  private async setAside(
    message: InboundMessage,
    readable: {messageId: string | null; payload: unknown},
    failure: string,
    receivedAt: Date,
  ): Promise<void> {
    const error = `failed ${ATTEMPTS} attempts: ${failure}`;
    this.logger.error(
      `message ${readable.messageId ?? 'without id'} set aside, ${error}`,
      undefined,
      CONTEXT,
    );
    await this.reject(message, readable, error, receivedAt);
  }

  /**
   * With a readable id the use case decides: a known id is counted as a duplicate and nothing
   * is published; otherwise the dead letter goes out and then the record is written, so a
   * failed publish is delivered again (A-13). Without an id there is nothing to count against.
   */
  private async reject(
    message: InboundMessage,
    readable: {messageId: string | null; payload: unknown},
    refusal: string,
    receivedAt: Date,
  ): Promise<void> {
    // One text for the dead letter, the record and the log: bounded and storable everywhere.
    const error = storableText(refusal);
    if (readable.messageId === null) {
      await this.deadLetter(message, error);
      this.logger.warn(`message rejected: ${error}`, CONTEXT);
      return;
    }
    const result = await this.rejectTreasuryMessage.execute(
      {
        messageId: readable.messageId,
        programId: readableString(readable.payload, 'programId', PROGRAM_ID_MAX_LENGTH),
        type: readableString(readable.payload, 'type', MESSAGE_TYPE_MAX_LENGTH),
        payload: storablePayload(readable.payload),
        error,
        receivedAt,
      },
      () => this.deadLetter(message, error),
    );
    if (result === 'duplicate') {
      this.logger.log(`message ${readable.messageId} seen again, counted as duplicate`, CONTEXT);
      return;
    }
    this.logger.warn(`message rejected: ${error}`, CONTEXT);
  }

  /**
   * ADR-0003: the original bytes, with what went wrong and where it came from in the headers. A
   * value or key too large to republish is left out and named in `valueOmitted` or `keyOmitted`:
   * the source position still finds it on the treasury topic, and a dead letter the broker
   * refuses would stall it. Bounded key, value and headers stay under the broker's 1 MiB.
   */
  private deadLetter(message: InboundMessage, error: string): Promise<void> {
    const value = message.value ?? Buffer.alloc(0);
    const keyBytes = message.key === null ? 0 : Buffer.byteLength(message.key, 'utf8');
    const valueFits = value.length <= DEAD_LETTER_VALUE_MAX_BYTES;
    const keyFits = keyBytes <= DEAD_LETTER_KEY_MAX_BYTES;
    return this.source.publish(TREASURY_DEAD_LETTER_TOPIC, [
      {
        key: keyFits ? message.key : null,
        value: valueFits ? value : Buffer.alloc(0),
        headers: {
          error,
          sourceTopic: message.topic,
          sourcePartition: String(message.partition),
          sourceOffset: message.offset,
          correlationId: currentCorrelationId() ?? 'unknown',
          ...(valueFits ? {} : {valueOmitted: `${value.length} bytes`}),
          ...(keyFits ? {} : {keyOmitted: `${keyBytes} bytes`}),
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

/**
 * A-13 clause 4: a message that makes the parser itself throw, such as an unknown field nested
 * thousands of arrays deep overflowing class-transformer's stack, is malformed like any other.
 * Left to propagate it would keep the offset uncommitted and stall the partition for good.
 */
const parsedOrRefused = async <T extends {readonly ok: boolean}>(
  parse: () => Promise<T>,
): Promise<T | {readonly ok: false; readonly error: string}> => {
  try {
    return await parse();
  } catch (reason: unknown) {
    const detail = reason instanceof Error ? reason.message : String(reason);
    return {ok: false, error: `message could not be parsed: ${detail}`};
  }
};

const readableMessageId = (payload: unknown): string | null =>
  readableString(payload, 'messageId', MESSAGE_ID_MAX_LENGTH);

/** ADR-0010: a keep within the window, and every other departure from the snapshot, is visible. */
const describeNote = (programId: string, note: ReconciliationNote): string => {
  if ('invoiceId' in note) return `reconciliation ${programId}: ${note.kind} ${note.invoiceId}`;
  return `reconciliation ${programId}: ${note.kind}`;
};
