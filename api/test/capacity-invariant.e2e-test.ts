import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {expectLedgerInvariants} from './support/ledger-invariants';
import {
  announceProgram,
  awaitAvailability,
  publishCapacityUpdate,
  readAvailability,
  USD,
} from './support/programs';
import {createTestApp, httpServer} from './support/test-app';
import {bearer, validToken} from './support/tokens';

const TEN_MILLION_USD = 1_000_000_000n;
const ONE_MILLION_USD = 100_000_000;
const PARALLEL_REQUESTS = 25;
const EXPECTED_CREATED = 10;
const AT_10_05 = new Date('2026-09-21T10:05:00.000Z');
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');

describe('Capacity invariants', () => {
  let first: INestApplication;
  let second: INestApplication;
  let token: string;

  beforeAll(async () => {
    // Two application instances, one database (INV-01, ADR-0008). Neither listens on a port:
    // supertest binds each to its own ephemeral one.
    [first, second] = await Promise.all([createTestApp(), createTestApp()]);
    token = await validToken();
  });

  afterEach(async () => {
    await expectLedgerInvariants(first);
  });

  afterAll(async () => {
    await Promise.all([first.close(), second.close()]);
  });

  const reserve = (
    app: INestApplication,
    programId: string,
    invoiceId: string,
    invoiceAmount: number,
  ): request.Test =>
    request(httpServer(app))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(token))
      .send({invoiceId, invoiceAmount, invoiceCurrency: USD});

  it('[INV-01] should never overcommit under parallel reservations on one program', async () => {
    const programId = await announceProgram(first, {currency: USD, creditLimit: TEN_MILLION_USD});
    await awaitAvailability(second, programId, token, (_body, status) => status === 200);

    const responses = await Promise.all(
      Array.from({length: PARALLEL_REQUESTS}, (_, index) =>
        reserve(index % 2 === 0 ? first : second, programId, `INV-${index}`, ONE_MILLION_USD),
      ),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(EXPECTED_CREATED);
    expect(statuses.filter((status) => status === 422)).toHaveLength(
      PARALLEL_REQUESTS - EXPECTED_CREATED,
    );
    const availability = await readAvailability(second, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      limit: 1_000_000_000,
      reserved: EXPECTED_CREATED * ONE_MILLION_USD,
      available: 0,
      overcommitted: false,
    });
  });

  it('[INV-03] should keep program reserved equal to the sum of held of active reservations after every scenario', async () => {
    const programId = await announceProgram(first, {currency: USD, creditLimit: TEN_MILLION_USD});

    await reserve(first, programId, 'INV-1', 3 * ONE_MILLION_USD).expect(201);
    await reserve(second, programId, 'INV-2', 2 * ONE_MILLION_USD).expect(201);
    await reserve(first, programId, 'INV-3', ONE_MILLION_USD).expect(201);
    await publishCapacityUpdate(first, {
      programId,
      currency: USD,
      creditLimit: 4n * BigInt(ONE_MILLION_USD),
      eventTime: AT_10_05,
    });
    await awaitAvailability(first, programId, token, (body) => body.overcommitted);
    await reserve(second, programId, 'INV-4', 1).expect(422);
    await reserve(first, programId, 'INV-2', 2 * ONE_MILLION_USD).expect(409);
    await publishCapacityUpdate(first, {
      programId,
      currency: USD,
      creditLimit: TEN_MILLION_USD,
      eventTime: AT_10_10,
    });
    await awaitAvailability(first, programId, token, (body) => !body.overcommitted);
    await reserve(second, programId, 'INV-5', ONE_MILLION_USD).expect(201);

    const availability = await readAvailability(first, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: 7 * ONE_MILLION_USD,
      available: 3 * ONE_MILLION_USD,
      overcommitted: false,
    });
  });
});
