import {randomUUID} from 'node:crypto';
import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {KafkaService} from '../src/messaging/kafka.service';
import {DevTreasuryProducer} from '../src/modules/capacity/infrastructure/messaging/dev-treasury-producer';
import {MemoryStream} from './support/memory-stream';
import {createAppWith, errorBodyOf, httpServer} from './support/test-app';
import {bearer, validToken} from './support/tokens';

const EUR = 'EUR';
const FIVE_MILLION_EUR_MINOR = 500_000_000;
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const REQUEST_CORRELATION_ID = `request-${randomUUID()}`;
const WAIT_MS = 30_000;

const uniqueId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

const availabilityOnceAnnounced = async (
  app: INestApplication,
  programId: string,
  token: string,
  correlationId?: string,
): Promise<request.Response> => {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const call = request(httpServer(app))
      .get(`/programs/${programId}/availability`)
      .set('Authorization', bearer(token));
    const response = await (correlationId === undefined
      ? call
      : call.set('x-correlation-id', correlationId));
    if (response.status === 200) return response;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${programId} was not announced within ${WAIT_MS}ms`);
};

describe('Programs', () => {
  let app: INestApplication;
  let logs: MemoryStream;
  let producer: DevTreasuryProducer;
  let token: string;

  beforeAll(async () => {
    logs = new MemoryStream();
    app = await createAppWith({logOutput: logs});
    producer = new DevTreasuryProducer(app.get(KafkaService));
    token = await validToken();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[AC-20] should create the program from the first capacity update and expose its availability', async () => {
    const programId = uniqueId('PRG');

    await producer.publishCapacityUpdate({
      messageId: uniqueId('m'),
      programId,
      currency: EUR,
      creditLimit: BigInt(FIVE_MILLION_EUR_MINOR),
      eventTime: AT_10_00,
    });

    const response = await availabilityOnceAnnounced(app, programId, token);
    expect(response.body).toEqual({
      programId,
      currency: EUR,
      limit: FIVE_MILLION_EUR_MINOR,
      reserved: 0,
      available: FIVE_MILLION_EUR_MINOR,
      overcommitted: false,
      asOf: null,
    });
  });

  it('should answer 404 PROGRAM_NOT_FOUND for a program the treasury never announced', async () => {
    const response = await request(httpServer(app))
      .get('/programs/PRG-never-announced/availability')
      .set('Authorization', bearer(token))
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'PROGRAM_NOT_FOUND',
      message: expect.stringContaining('PRG-never-announced') as string,
    });
  });

  it('should answer 400 to a program id longer than the contract allows', async () => {
    const response = await request(httpServer(app))
      .get(`/programs/${'x'.repeat(65)}/availability`)
      .set('Authorization', bearer(token))
      .expect(400);

    expect(errorBodyOf(response).code).toBe('VALIDATION_FAILED');
  });

  it('[AC-40] should write JSON log lines sharing one correlation id per request and per message', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m');

    await producer.publishCapacityUpdate({
      messageId,
      programId,
      currency: EUR,
      creditLimit: BigInt(FIVE_MILLION_EUR_MINOR),
      eventTime: AT_10_00,
    });
    const response = await availabilityOnceAnnounced(app, programId, token, REQUEST_CORRELATION_ID);
    expect(response.headers['x-correlation-id']).toBe(REQUEST_CORRELATION_ID);

    // Every line is JSON, or lines() would have thrown.
    const lines = logs.lines();
    const requestLines = lines.filter((line) => line.correlationId === REQUEST_CORRELATION_ID);
    const messageLines = lines.filter((line) => line.correlationId === messageId);

    expect(requestLines.length).toBeGreaterThanOrEqual(1);
    expect(requestLines.every((line) => typeof line.timestamp === 'string')).toBe(true);
    expect(
      requestLines.some((line) => String(line.message).includes(`/programs/${programId}`)),
    ).toBe(true);

    expect(messageLines.length).toBeGreaterThanOrEqual(2);
    expect(messageLines.some((line) => String(line.message).includes('received message'))).toBe(
      true,
    );
    expect(messageLines.some((line) => String(line.message).includes('applied'))).toBe(true);
  });
});
