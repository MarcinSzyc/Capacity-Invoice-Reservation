import {randomUUID} from 'node:crypto';
import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {KafkaService} from '../../src/messaging/kafka.service';
import {DevTreasuryProducer} from '../../src/modules/capacity/infrastructure/messaging/dev-treasury-producer';
import {httpServer} from './test-app';
import {bearer, validToken} from './tokens';

export const USD = 'USD';
export const EUR = 'EUR';
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
