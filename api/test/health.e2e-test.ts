import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createTestApp, httpServer} from './support/test-app';

const CORRELATION_ID = 'correlation-from-the-caller';

describe('Health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[AC-00] should answer liveness with 200 and no business data, without a token', async () => {
    const response = await request(httpServer(app)).get('/health').expect(200);

    expect(response.body).toEqual({status: 'ok'});
  });

  it('should report the database and the broker as up once both answer', async () => {
    const response = await request(httpServer(app)).get('/health/ready').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      checks: {database: 'up', broker: 'up'},
    });
  });

  it('should echo the correlation id the caller sent', async () => {
    const response = await request(httpServer(app))
      .get('/health')
      .set('x-correlation-id', CORRELATION_ID)
      .expect(200);

    expect(response.headers['x-correlation-id']).toBe(CORRELATION_ID);
  });

  it('should answer an unknown route with the error envelope', async () => {
    const response = await request(httpServer(app)).get('/nothing-here').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String) as string,
    });
  });
});
