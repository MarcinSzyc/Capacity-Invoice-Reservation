import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {expectLedgerInvariants} from './support/ledger-invariants';
import {announceProgram, EUR, readAvailability, USD} from './support/programs';
import {createTestApp, errorBodyOf, httpServer} from './support/test-app';
import {bearer, TEST_CLIENT_ID, validToken} from './support/tokens';

const TEN_MILLION_USD = 1_000_000_000n;
const TWO_POINT_SEVEN_FIVE_MILLION_EUR = 275_000_000;
const THREE_POINT_ZERO_TWO_FIVE_MILLION_USD = 302_500_000;
const ONE_MILLION_EUR = 100_000_000;
const ONE_POINT_NINE_TWO_FIVE_MILLION_USD = 192_500_000;
const FIVE_HUNDRED_THOUSAND_USD = 50_000_000;
const ONE_MILLION_USD = 100_000_000;
const INVOICE_A = 'INV-A';
const INVOICE_B = 'INV-B';
const ONE_MILLION_IDR = 1_000_000;
const IDR = 'IDR';
const OTHER_CLIENT = 'client-other';

interface MovementBody {
  readonly kind: string;
  readonly amount: number;
  readonly reason: string | null;
  readonly releaseId: string | null;
  readonly messageId: string | null;
  readonly clientId: string | null;
  readonly occurredAt: string;
}

describe('Releases', () => {
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

  const reserve = (
    programId: string,
    body: Record<string, unknown>,
    withToken: string = token,
  ): request.Test =>
    request(httpServer(app))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(withToken))
      .send(body);

  const release = (
    programId: string,
    invoiceId: string,
    body: Record<string, unknown>,
    withToken: string = token,
  ): request.Test =>
    request(httpServer(app))
      .post(`/programs/${programId}/reservations/${invoiceId}/releases`)
      .set('Authorization', bearer(withToken))
      .send(body);

  const readReservation = (programId: string, invoiceId: string): request.Test =>
    request(httpServer(app))
      .get(`/programs/${programId}/reservations/${invoiceId}`)
      .set('Authorization', bearer(token));

  /** A USD program holding INV-B: 2 750 000.00 EUR at 1.10, so 3 025 000.00 USD (AC-10's given). */
  const programHoldingInvoiceB = async (): Promise<string> => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      invoiceCurrency: EUR,
      rate: '1.10',
    }).expect(201);
    return programId;
  };

  it('[AC-10] should apply a partial release in invoice currency, reduce held by the converted amount and grow availability', async () => {
    const programId = await programHoldingInvoiceB();

    const response = await release(programId, INVOICE_B, {
      releaseId: 'R-1',
      amount: ONE_MILLION_EUR,
    }).expect(200);

    expect(response.body).toMatchObject({
      invoiceId: INVOICE_B,
      held: ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
      releasedInvoiceAmount: ONE_MILLION_EUR,
      reservedAmount: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
      status: 'active',
    });
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
      available: Number(TEN_MILLION_USD) - ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
    });
  });

  it('[AC-11] should close the reservation when the release carries no amount', async () => {
    const programId = await programHoldingInvoiceB();
    await release(programId, INVOICE_B, {releaseId: 'R-1', amount: ONE_MILLION_EUR}).expect(200);

    const response = await release(programId, INVOICE_B, {releaseId: 'R-2'}).expect(200);

    expect(response.body).toMatchObject({
      held: 0,
      releasedInvoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      status: 'closed',
    });
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: 0,
      available: Number(TEN_MILLION_USD),
    });
  });

  it('[AC-12] should close exactly at zero when the final instalment does not divide evenly by the rate', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_MILLION_EUR,
      invoiceCurrency: EUR,
      rate: '1.13',
    }).expect(201);

    // Rounding each instalment on its own would leave held at 1: 37 666 666 twice plus
    // 37 666 667 is 112 999 999, one minor unit short of the 113 000 000 reserved (ADR-0009).
    await release(programId, INVOICE_A, {releaseId: 'R-1', amount: 33_333_333}).expect(200);
    await release(programId, INVOICE_A, {releaseId: 'R-2', amount: 33_333_333}).expect(200);
    const last = await release(programId, INVOICE_A, {
      releaseId: 'R-3',
      amount: 33_333_334,
    }).expect(200);

    expect(last.body).toMatchObject({held: 0, status: 'closed'});
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: 0,
      available: Number(TEN_MILLION_USD),
    });
  });

  it('[AC-13] should reject a release beyond held with RELEASE_EXCEEDS_HELD and change nothing', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: FIVE_HUNDRED_THOUSAND_USD,
      invoiceCurrency: USD,
    }).expect(201);

    const response = await release(programId, INVOICE_A, {
      releaseId: 'R-1',
      amount: FIVE_HUNDRED_THOUSAND_USD + 1,
    }).expect(422);

    const error = errorBodyOf(response);
    expect(error.code).toBe('RELEASE_EXCEEDS_HELD');
    expect(error.held).toBe(FIVE_HUNDRED_THOUSAND_USD);
    expect(error.remainingInvoiceAmount).toBe(FIVE_HUNDRED_THOUSAND_USD);
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: FIVE_HUNDRED_THOUSAND_USD});
  });

  it('should answer 400 naming the field for a malformed release body, never 500', async () => {
    const programId = await programHoldingInvoiceB();
    const refused: Record<string, unknown>[] = [
      // An explicit null is a wrong value, not an absent field: `@IsOptional` would skip both
      // and the controller would then convert null, which is a 500 (the S-04 trap, again).
      {releaseId: 'R-1', amount: null},
      {releaseId: 'R-1', reason: null},
      {releaseId: 'R-1', amount: 0},
      {releaseId: 'R-1', amount: 12.5},
      {releaseId: 'R-1', reason: 'refunded'},
      {amount: ONE_MILLION_EUR},
    ];

    for (const body of refused) {
      const response = await release(programId, INVOICE_B, body).expect(400);
      expect(errorBodyOf(response).code).toBe('VALIDATION_FAILED');
    }
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD});
  });

  it('[AC-14] should answer 404 RESERVATION_NOT_FOUND for a release on an unknown invoice', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});

    const unknownInvoice = await release(programId, 'INV-NOBODY', {releaseId: 'R-1'}).expect(404);
    const unknownProgram = await release('PRG-NOBODY', INVOICE_A, {releaseId: 'R-1'}).expect(404);

    expect(errorBodyOf(unknownInvoice).code).toBe('RESERVATION_NOT_FOUND');
    expect(errorBodyOf(unknownProgram).code).toBe('PROGRAM_NOT_FOUND');
  });

  it('[AC-15] should answer 409 RESERVATION_ALREADY_RELEASED for a new releaseId on a closed reservation', async () => {
    const programId = await programHoldingInvoiceB();
    await release(programId, INVOICE_B, {releaseId: 'R-1'}).expect(200);

    const response = await release(programId, INVOICE_B, {releaseId: 'R-2'}).expect(409);

    expect(errorBodyOf(response).code).toBe('RESERVATION_ALREADY_RELEASED');
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0});
  });

  it('should release a remainder whose held has rounded to zero, and only then close it (AC-15)', async () => {
    // AC-15 amended 2026-09-24: a remainder worth less than half a minor unit of the program
    // currency rounds `held` to zero while the invoice still owes. The reservation stays
    // active and can be released to the end; before the amendment it was stuck forever.
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_MILLION_IDR,
      invoiceCurrency: IDR,
      rate: '0.000065',
    }).expect(201);

    const almost = await release(programId, INVOICE_A, {
      releaseId: 'R-1',
      amount: ONE_MILLION_IDR - 1_000,
    }).expect(200);
    expect(almost.body).toMatchObject({held: 0, status: 'active'});

    const closed = await release(programId, INVOICE_A, {releaseId: 'R-2'}).expect(200);

    expect(closed.body).toMatchObject({
      held: 0,
      releasedInvoiceAmount: ONE_MILLION_IDR,
      status: 'closed',
    });
    const reservation = await readReservation(programId, INVOICE_A).expect(200);
    const movements = (reservation.body as {movements: MovementBody[]}).movements;
    expect(movements.map((movement) => [movement.kind, movement.amount])).toEqual([
      ['reserve', 65],
      ['release', -65],
      ['release', 0],
    ]);
  });

  it('[AC-16] should answer 409 RELEASE_ALREADY_PROCESSED with the original outcome for a repeated releaseId', async () => {
    const programId = await programHoldingInvoiceB();
    await release(programId, INVOICE_B, {releaseId: 'R-1', amount: ONE_MILLION_EUR}).expect(200);
    const afterFirst = await readReservation(programId, INVOICE_B).expect(200);
    const appliedAt = (afterFirst.body as {movements: MovementBody[]}).movements[1]?.occurredAt;
    // A second, different release moves `held` on, so the outcome R-1 had is no longer the
    // state now. Without this the assertion below could not tell the two apart.
    await release(programId, INVOICE_B, {releaseId: 'R-2', amount: 50_000_000}).expect(200);

    // The same id with the same amount, and with a different one: both are the same repayment.
    for (const amount of [ONE_MILLION_EUR, 50_000_000]) {
      const repeated = await release(programId, INVOICE_B, {releaseId: 'R-1', amount}).expect(409);
      const error = errorBodyOf(repeated);
      expect(error.code).toBe('RELEASE_ALREADY_PROCESSED');
      expect(error.heldAfter).toBe(ONE_POINT_NINE_TWO_FIVE_MILLION_USD);
      expect(error.appliedAt).toBe(appliedAt);
    }
    // R-1's outcome is 192 500 000, while the reservation now holds less because R-2 followed.
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 137_500_000});
    const reservation = await readReservation(programId, INVOICE_B).expect(200);
    expect((reservation.body as {movements: MovementBody[]}).movements).toHaveLength(3);
  });

  it('[AC-17] should record the release reason on the movement, defaulting to repaid, without changing the effect', async () => {
    const programId = await programHoldingInvoiceB();

    await release(programId, INVOICE_B, {
      releaseId: 'R-1',
      amount: ONE_MILLION_EUR,
      reason: 'cancelled',
    }).expect(200);
    await release(programId, INVOICE_B, {releaseId: 'R-2', amount: ONE_MILLION_EUR}).expect(200);

    const reservation = await readReservation(programId, INVOICE_B).expect(200);
    const releases = (reservation.body as {movements: MovementBody[]}).movements.filter(
      (movement) => movement.kind === 'release',
    );
    expect(releases.map((movement) => movement.reason)).toEqual(['cancelled', 'repaid']);
    // The same amount at the same rate moves held the same way, whatever the reason says.
    expect(releases.map((movement) => movement.amount)).toEqual([-110_000_000, -110_000_000]);
  });

  it('[AC-18] should reflect a reservation and a release in availability immediately after the response', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});

    await reserve(programId, {
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_MILLION_USD,
      invoiceCurrency: USD,
    }).expect(201);
    const afterReserve = await readAvailability(app, programId, token).expect(200);

    await release(programId, INVOICE_A, {releaseId: 'R-1', amount: ONE_MILLION_USD / 2}).expect(
      200,
    );
    const afterRelease = await readAvailability(app, programId, token).expect(200);

    expect(afterReserve.body).toEqual({
      programId,
      currency: USD,
      limit: Number(TEN_MILLION_USD),
      reserved: ONE_MILLION_USD,
      available: Number(TEN_MILLION_USD) - ONE_MILLION_USD,
      overcommitted: false,
      asOf: null,
    });
    expect(afterRelease.body).toMatchObject({
      reserved: ONE_MILLION_USD / 2,
      available: Number(TEN_MILLION_USD) - ONE_MILLION_USD / 2,
    });
  });

  it('[AC-19] should return the reservation with its amounts, rate, status, source and movements', async () => {
    const programId = await programHoldingInvoiceB();
    await release(programId, INVOICE_B, {releaseId: 'R-1', amount: ONE_MILLION_EUR}).expect(200);

    const response = await readReservation(programId, INVOICE_B).expect(200);

    const body = response.body as Record<string, unknown> & {movements: MovementBody[]};
    expect(body).toMatchObject({
      programId,
      invoiceId: INVOICE_B,
      invoiceAmount: TWO_POINT_SEVEN_FIVE_MILLION_EUR,
      invoiceCurrency: EUR,
      reservedAmount: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
      held: ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
      releasedInvoiceAmount: ONE_MILLION_EUR,
      rate: '1.1',
      status: 'active',
      source: 'client',
    });
    expect(body.movements).toEqual([
      {
        kind: 'reserve',
        amount: THREE_POINT_ZERO_TWO_FIVE_MILLION_USD,
        reason: null,
        releaseId: null,
        messageId: null,
        clientId: TEST_CLIENT_ID,
        occurredAt: expect.any(String) as string,
      },
      {
        kind: 'release',
        amount: -110_000_000,
        reason: 'repaid',
        releaseId: 'R-1',
        messageId: null,
        clientId: TEST_CLIENT_ID,
        occurredAt: expect.any(String) as string,
      },
    ]);
  });

  it('[AC-34] should record the authenticated client id on reserve and release movements', async () => {
    const otherToken = await validToken(OTHER_CLIENT);
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION_USD});
    await reserve(
      programId,
      {invoiceId: INVOICE_A, invoiceAmount: ONE_MILLION_USD, invoiceCurrency: USD},
      token,
    ).expect(201);

    await release(
      programId,
      INVOICE_A,
      {releaseId: 'R-1', amount: ONE_MILLION_USD / 2},
      otherToken,
    ).expect(200);

    const reservation = await readReservation(programId, INVOICE_A).expect(200);
    const movements = (reservation.body as {movements: MovementBody[]}).movements;
    expect(movements.map((movement) => [movement.kind, movement.clientId])).toEqual([
      ['reserve', TEST_CLIENT_ID],
      ['release', OTHER_CLIENT],
    ]);
  });
});
