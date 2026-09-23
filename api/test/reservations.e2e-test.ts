import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {
  announceProgram,
  awaitAvailability,
  EUR,
  publishCapacityUpdate,
  readAvailability,
  USD,
} from './support/programs';
import {expectLedgerInvariants} from './support/ledger-invariants';
import {createTestApp, errorBodyOf, httpServer} from './support/test-app';
import {bearer, validToken} from './support/tokens';

const TEN_MILLION_USD = 1_000_000_000n;
const TWELVE_MILLION_USD = 1_200_000_000n;
const FOUR_MILLION_USD = 400_000_000;
const THREE_MILLION_USD = 300_000_000n;
const TWO_MILLION_USD = 200_000_000;
const ONE_POINT_TWO_MILLION_USD = 120_000_000;
const TWO_POINT_SEVEN_FIVE_MILLION_EUR = 275_000_000;
const THREE_POINT_ZERO_TWO_FIVE_MILLION_USD = 302_500_000;
const HALF_A_MILLION_USD = 50_000_000;
const USD_IN_LOWER_CASE = 'usd';
const INVOICE_A = 'INV-A';
const INVOICE_B = 'INV-B';
const AT_10_05 = new Date('2026-09-21T10:05:00.000Z');

interface ReservationBody {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: number;
  readonly invoiceCurrency: string;
  readonly reservedAmount: number;
  readonly held: number;
  readonly rate: string;
  readonly status: string;
  readonly source: string;
  readonly createdAt: string;
}

describe('Reservations', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await validToken();
  });

  afterEach(async () => {
    await expectLedgerInvariants(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const reserve = (programId: string, body: Record<string, unknown>): request.Test =>
    request(httpServer(app))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(token))
      .send(body);

  it('[AC-01] should reserve within capacity and show the amounts, active status and reduced availability', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});

    const response = await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);

    const reservation = response.body as ReservationBody;
    expect(reservation).toEqual({
      programId,
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
      reservedAmount: ONE_POINT_TWO_MILLION_USD,
      held: ONE_POINT_TWO_MILLION_USD,
      rate: '1',
      status: 'active',
      source: 'client',
      createdAt: expect.any(String) as string,
    });
    expect(new Date(reservation.createdAt).toISOString()).toBe(reservation.createdAt);

    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      limit: 1_000_000_000,
      reserved: ONE_POINT_TWO_MILLION_USD,
      available: 880_000_000,
      overcommitted: false,
    });
  });

  it('[AC-02] should reserve exactly the remaining capacity and leave availability at zero', async () => {
    const programId = await announceProgram(app, {
      currency: USD,
      creditLimit: BigInt(HALF_A_MILLION_USD),
    });

    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: HALF_A_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);

    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: HALF_A_MILLION_USD,
      available: 0,
      overcommitted: false,
    });
  });

  it('[AC-03] should reject a reservation that exceeds available capacity with CAPACITY_EXCEEDED and the available amount', async () => {
    const programId = await announceProgram(app, {
      currency: USD,
      creditLimit: BigInt(HALF_A_MILLION_USD),
    });

    const response = await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: HALF_A_MILLION_USD + 1,
      invoiceCurrency: USD,
    }).expect(422);

    expect(response.body).toEqual({
      statusCode: 422,
      code: 'CAPACITY_EXCEEDED',
      message: expect.any(String) as string,
      available: HALF_A_MILLION_USD,
    });
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0, available: HALF_A_MILLION_USD});
  });

  it('[AC-04] should answer 404 PROGRAM_NOT_FOUND for a reservation on an unknown program', async () => {
    const response = await reserve('PRG-never-announced', {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(404);

    expect(errorBodyOf(response).code).toBe('PROGRAM_NOT_FOUND');
  });

  it('[AC-05] should answer 409 RESERVATION_ALREADY_EXISTS with the existing reservation for a repeated invoice', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    const body = {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
    };
    const first = await reserve(programId, body).expect(201);

    const sameAmount = await reserve(programId, body).expect(409);
    const otherAmount = await reserve(programId, {...body, invoiceAmount: 1}).expect(409);

    for (const response of [sameAmount, otherAmount]) {
      expect(response.body).toEqual({
        statusCode: 409,
        code: 'RESERVATION_ALREADY_EXISTS',
        message: expect.any(String) as string,
        reservation: first.body as ReservationBody,
      });
    }
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: ONE_POINT_TWO_MILLION_USD});
  });

  it('[AC-08] should answer 400 naming the field for a non-positive, non-integer or non-ISO-4217 reservation', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    const valid = {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
    };
    const cases: {body: Record<string, unknown>; field: string}[] = [
      {body: {...valid, invoiceAmount: 0}, field: 'invoiceAmount'},
      {body: {...valid, invoiceAmount: -1}, field: 'invoiceAmount'},
      {body: {...valid, invoiceAmount: 12.5}, field: 'invoiceAmount'},
      {body: {...valid, invoiceCurrency: 'XYZ'}, field: 'invoiceCurrency'},
      {body: {...valid, invoiceCurrency: 'XXXX'}, field: 'invoiceCurrency'},
    ];

    for (const {body, field} of cases) {
      const response = await reserve(programId, body).expect(400);
      const error = errorBodyOf(response);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details?.some((detail) => detail.startsWith(`${field} `))).toBe(true);
    }
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0});
  });

  it('should uppercase a currency code on both edges, so a lower case code reserves normally (A-10)', async () => {
    const programId = await announceProgram(app, {
      currency: USD_IN_LOWER_CASE,
      creditLimit: TEN_MILLION_USD,
    });

    const response = await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD_IN_LOWER_CASE,
    }).expect(201);

    expect(response.body).toMatchObject({invoiceCurrency: USD});
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      currency: USD,
      reserved: ONE_POINT_TWO_MILLION_USD,
    });
  });

  it('[AC-06] should convert a EUR invoice at the given rate, store the rate and reduce availability by the converted amount', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});

    const response = await reserve(programId, {
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      invoiceCurrency: EUR,
      rate: '1.10',
    }).expect(201);

    expect(response.body).toMatchObject({
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      invoiceCurrency: EUR,
      reservedAmount: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
      held: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
      rate: '1.1',
      status: 'active',
    });
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
      available: Number(TEN_MILLION_USD) - THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
    });
  });

  it('[AC-07] should answer 400 naming rate when it is missing for a cross-currency reservation or not 1 for a same-currency one', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    const refused: Record<string, unknown>[] = [
      {invoiceId: INVOICE_B, invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR, invoiceCurrency: EUR},
      {
        invoiceId: INVOICE_A,
        invoiceAmount: ONE_POINT_TWO_MILLION_USD,
        invoiceCurrency: USD,
        rate: '1.05',
      },
    ];

    for (const body of refused) {
      const response = await reserve(programId, body).expect(400);
      const error = errorBodyOf(response);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details?.some((detail) => detail.startsWith('rate '))).toBe(true);
    }
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0});

    const accepted = await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      invoiceCurrency: USD,
      rate: '1.00',
    }).expect(201);
    expect(accepted.body).toMatchObject({rate: '1'});
  });

  it('should answer 400 naming rate for a rate that is not a decimal string (ADR-0006, INV-08)', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    const base = {
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      invoiceCurrency: EUR,
    };

    for (const rate of [1.1, 'abc', '0', '0.000', '1.123456789', '', null]) {
      const response = await reserve(programId, {...base, rate}).expect(400);
      const error = errorBodyOf(response);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details?.some((detail) => detail.startsWith('rate '))).toBe(true);
    }
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0});
  });

  it('[AC-09] should reject any reservation on an overcommitted program with CAPACITY_EXCEEDED and available 0', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: FOUR_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);
    await publishCapacityUpdate(app, {
      programId,
      currency: USD,
      creditLimit: THREE_MILLION_USD,
      eventTime: AT_10_05,
    });
    await awaitAvailability(app, programId, token, (body) => body.overcommitted);

    const response = await reserve(programId, {
      invoiceId: INVOICE_B,
      invoiceAmount: 1,
      invoiceCurrency: USD,
    }).expect(422);

    expect(response.body).toMatchObject({code: 'CAPACITY_EXCEEDED', available: 0});
  });

  it('[AC-21] should raise available when the treasury raises the limit above current usage', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: FOUR_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);

    await publishCapacityUpdate(app, {
      programId,
      currency: USD,
      creditLimit: TWELVE_MILLION_USD,
      eventTime: AT_10_05,
    });

    const availability = await awaitAvailability(
      app,
      programId,
      token,
      (body) => body.limit === Number(TWELVE_MILLION_USD),
    );
    expect(availability.body).toMatchObject({
      limit: 1_200_000_000,
      reserved: FOUR_MILLION_USD,
      available: 800_000_000,
      overcommitted: false,
    });
  });

  it('[AC-22] should read available 0 and overcommitted true when the limit drops below usage while every held stays', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    const first = await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: TWO_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);
    const second = await reserve(programId, {
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);

    await publishCapacityUpdate(app, {
      programId,
      currency: USD,
      creditLimit: THREE_MILLION_USD,
      eventTime: AT_10_05,
    });

    const availability = await awaitAvailability(
      app,
      programId,
      token,
      (body) => body.overcommitted,
    );
    expect(availability.body).toMatchObject({
      limit: 300_000_000,
      reserved: FOUR_MILLION_USD,
      available: 0,
      overcommitted: true,
    });
    // Every held stays: a repeated reserve answers 409 with the reservation as it is now.
    for (const created of [first, second]) {
      const kept = created.body as ReservationBody;
      const again = await reserve(programId, {
        invoiceId: kept.invoiceId,
        invoiceAmount: kept.invoiceAmount,
        invoiceCurrency: USD,
      }).expect(409);
      expect((again.body as {reservation: ReservationBody}).reservation.held).toBe(TWO_MILLION_USD);
    }
  });
});
