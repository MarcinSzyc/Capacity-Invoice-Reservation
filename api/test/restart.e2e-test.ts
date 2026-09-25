import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {announceProgram, readAvailability, USD} from './support/programs';
import {createTestApp, httpServer} from './support/test-app';
import {bearer, validToken} from './support/tokens';

const TEN_MILLION_USD = 1_000_000_000n;
const ONE_POINT_TWO_MILLION_USD = 120_000_000;
const TWO_HUNDRED_THOUSAND_USD = 20_000_000;
const INVOICE_A = 'INV-A';
const RELEASE_ID = 'R-1';

describe('Restart', () => {
  it('[AC-39] should read the same availability and reservations after a restart', async () => {
    const token = await validToken();
    const first = await createTestApp();
    const programId = await announceProgram(first, {currency: USD, creditLimit: TEN_MILLION_USD});
    await request(httpServer(first))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(token))
      .send({invoiceId: INVOICE_A, invoiceAmount: ONE_POINT_TWO_MILLION_USD, invoiceCurrency: USD})
      .expect(201);
    await request(httpServer(first))
      .post(`/programs/${programId}/reservations/${INVOICE_A}/releases`)
      .set('Authorization', bearer(token))
      .send({releaseId: RELEASE_ID, amount: TWO_HUNDRED_THOUSAND_USD})
      .expect(200);
    const read = async (
      app: INestApplication,
    ): Promise<{availability: unknown; reservation: unknown}> => ({
      availability: (await readAvailability(app, programId, token).expect(200)).body,
      reservation: (
        await request(httpServer(app))
          .get(`/programs/${programId}/reservations/${INVOICE_A}`)
          .set('Authorization', bearer(token))
          .expect(200)
      ).body,
    });
    const before = await read(first);
    await first.close();

    const second = await createTestApp();
    try {
      const after = await read(second);

      expect(after).toEqual(before);
      expect(before.availability).toMatchObject({
        reserved: ONE_POINT_TWO_MILLION_USD - TWO_HUNDRED_THOUSAND_USD,
      });
    } finally {
      await second.close();
    }
  });
});
