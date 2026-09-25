import {randomUUID} from 'node:crypto';
import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {KafkaService} from '../../src/messaging/kafka.service';
import {DevTreasuryProducer} from '../../src/modules/capacity/infrastructure/messaging/dev-treasury-producer';
import {
  PrismaTreasuryMessageStore,
  StoredTreasuryMessage,
} from '../../src/modules/capacity/infrastructure/persistence/prisma-treasury-message.store';
import {PrismaService} from '../../src/persistence/prisma.service';
import {httpServer} from './test-app';
import {bearer, validToken} from './tokens';

export const USD = 'USD';
export const EUR = 'EUR';
/** Minor units that are not two decimals: JPY counts whole yen, KWD counts thousandths (A-10). */
export const JPY = 'JPY';
export const KWD = 'KWD';
export const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const WAIT_MS = 30_000;
const POLL_MS = 100;

export const uniqueId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

export interface AvailabilityBody {
  readonly programId: string;
  readonly currency: string;
  readonly limit: number;
  readonly reserved: number;
  readonly available: number;
  readonly overcommitted: boolean;
  readonly asOf: string | null;
}

export interface Snapshot {
  readonly programId: string;
  readonly currency?: string;
  readonly creditLimit: bigint;
  readonly asOf: Date;
  readonly activeReservations?: readonly {
    readonly invoiceId: string;
    readonly heldAmount: bigint;
  }[];
  readonly messageId?: string;
}

/**
 * Publishes a reconciliation snapshot over the real broker and waits until the service has
 * recorded an outcome for it, since a treasury message is asynchronous. Returns the record.
 */
export const applySnapshot = async (
  app: INestApplication,
  {
    programId,
    currency = USD,
    creditLimit,
    asOf,
    activeReservations = [],
    messageId = uniqueId('m-snap'),
  }: Snapshot,
): Promise<StoredTreasuryMessage> => {
  await new DevTreasuryProducer(app.get(KafkaService)).publishSnapshot({
    messageId,
    programId,
    currency,
    creditLimit,
    asOf,
    activeReservations,
  });
  return awaitMessage(app, messageId, () => true);
};

/** Polls the message record until the predicate holds, for outcomes and duplicate counts. */
export const awaitMessage = async (
  app: INestApplication,
  messageId: string,
  predicate: (stored: StoredTreasuryMessage) => boolean,
): Promise<StoredTreasuryMessage> => {
  const store = new PrismaTreasuryMessageStore(app.get(PrismaService));
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const stored = await store.findById(messageId);
    if (stored !== null && predicate(stored)) return stored;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`message ${messageId} did not reach the expected record in ${WAIT_MS}ms`);
};

export interface CapacityUpdate {
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly eventTime?: Date;
}

/** Publishes a capacity update over the real broker, as the treasury would (A-05). */
export const publishCapacityUpdate = (
  app: INestApplication,
  {programId, currency, creditLimit, eventTime = AT_10_00}: CapacityUpdate,
): Promise<void> =>
  new DevTreasuryProducer(app.get(KafkaService)).publishCapacityUpdate({
    messageId: uniqueId('m'),
    programId,
    currency,
    creditLimit,
    eventTime,
  });

export const readAvailability = (
  app: INestApplication,
  programId: string,
  token: string,
  correlationId?: string,
): request.Test => {
  const call = request(httpServer(app))
    .get(`/programs/${programId}/availability`)
    .set('Authorization', bearer(token));
  return correlationId === undefined ? call : call.set('x-correlation-id', correlationId);
};

/** Polls availability until the predicate holds, because a treasury message is asynchronous. */
export const awaitAvailability = async (
  app: INestApplication,
  programId: string,
  token: string,
  predicate: (body: AvailabilityBody, status: number) => boolean,
  correlationId?: string,
): Promise<request.Response> => {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const response = await readAvailability(app, programId, token, correlationId);
    if (predicate(response.body as AvailabilityBody, response.status)) return response;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`availability of ${programId} did not reach the expected state in ${WAIT_MS}ms`);
};

export const awaitAnnounced = (
  app: INestApplication,
  programId: string,
  token: string,
  correlationId?: string,
): Promise<request.Response> =>
  awaitAvailability(app, programId, token, (_body, status) => status === 200, correlationId);

/** A fresh program with the given limit, announced by the treasury and visible over HTTP. */
export const announceProgram = async (
  app: INestApplication,
  {currency, creditLimit}: {currency: string; creditLimit: bigint},
): Promise<string> => {
  const programId = uniqueId('PRG');
  await publishCapacityUpdate(app, {programId, currency, creditLimit});
  await awaitAnnounced(app, programId, await validToken());
  return programId;
};
