import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {awaitAvailability, awaitMessage, uniqueId, USD} from './support/programs';
import {createProductionApp, createTestApp, httpServer} from './support/test-app';

const TEN_MILLION_USD = 1_000_000_000;
const DEV_ROUTES = [
  {method: 'get', path: '/dev/token'},
  {method: 'get', path: '/dev/programs/PRG-1/movements'},
  {method: 'post', path: '/dev/treasury'},
  {method: 'post', path: '/dev/reset'},
] as const;

interface MovementsBody {
  readonly programId: string;
  readonly currency: string;
  readonly movements: readonly {readonly kind: string; readonly limitAfter: number}[];
}

describe('Demo page dev endpoints', () => {
  let app: INestApplication;
  let production: INestApplication;

  beforeAll(async () => {
    [app, production] = await Promise.all([createTestApp(), createProductionApp()]);
  });

  afterAll(async () => {
    await Promise.all([app.close(), production.close()]);
  });

  it('[AC-38] should answer the dev endpoints the demo page relies on through the real api and topic in development and none of them in production', async () => {
    const programId = uniqueId('PRG');

    const issued = await request(httpServer(app)).get('/dev/token').expect(200);
    const {token} = issued.body as {token: string};
    const published = await request(httpServer(app))
      .post('/dev/treasury')
      .send({type: 'capacity_update', programId, currency: USD, creditLimit: TEN_MILLION_USD})
      .expect(202);
    const {messageId} = published.body as {messageId: string};
    await awaitMessage(app, messageId, (stored) => stored.outcome === 'applied');
    await awaitAvailability(app, programId, token, (body) => body.limit === TEN_MILLION_USD);
    const movements = await request(httpServer(app))
      .get(`/dev/programs/${programId}/movements`)
      .expect(200);

    expect(movements.body as MovementsBody).toEqual({
      programId,
      currency: USD,
      movements: [expect.objectContaining({kind: 'limit_set', limitAfter: TEN_MILLION_USD})],
    });
    for (const {method, path} of DEV_ROUTES) {
      const response = await request(httpServer(production))[method](path);
      expect(`${method.toUpperCase()} ${path} -> ${response.status}`).toBe(
        `${method.toUpperCase()} ${path} -> 404`,
      );
    }
  });

  it('should empty the ledger through the dev reset, so the page starts from nothing', async () => {
    const programId = uniqueId('PRG');
    const {token} = (await request(httpServer(app)).get('/dev/token').expect(200)).body as {
      token: string;
    };
    await request(httpServer(app))
      .post('/dev/treasury')
      .send({type: 'capacity_update', programId, currency: USD, creditLimit: TEN_MILLION_USD})
      .expect(202);
    await awaitAvailability(app, programId, token, (body) => body.limit === TEN_MILLION_USD);

    await request(httpServer(app)).post('/dev/reset').expect(204);

    await request(httpServer(app))
      .get(`/programs/${programId}/availability`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
