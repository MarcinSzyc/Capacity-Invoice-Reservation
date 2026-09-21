import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createTestApp, errorBodyOf, httpServer} from './support/test-app';
import {bearer, expiredToken, validToken, wronglySignedToken} from './support/tokens';

const AVAILABILITY_OF_UNKNOWN_PROGRAM = '/programs/PRG-nobody/availability';
const HEALTH_AND_DOCS = ['/health', '/health/ready', '/openapi.json', '/docs', '/redoc'];
const PROGRAM_WORDS = /programId|limit|reserved|available|currency/;

describe('Authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[AC-32] should answer 401 to a business request without a bearer token', async () => {
    const response = await request(httpServer(app))
      .get(AVAILABILITY_OF_UNKNOWN_PROGRAM)
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: expect.any(String) as string,
    });
  });

  it('[AC-33] should answer 401 to an expired or wrongly signed token', async () => {
    for (const token of [await expiredToken(), await wronglySignedToken()]) {
      const response = await request(httpServer(app))
        .get(AVAILABILITY_OF_UNKNOWN_PROGRAM)
        .set('Authorization', bearer(token))
        .expect(401);

      expect(errorBodyOf(response).code).toBe('UNAUTHORIZED');
    }
  });

  it('should answer 401 to an Authorization header that is not a bearer scheme', async () => {
    await request(httpServer(app))
      .get(AVAILABILITY_OF_UNKNOWN_PROGRAM)
      .set('Authorization', `Basic ${Buffer.from('user:password').toString('base64')}`)
      .expect(401);
  });

  it('should let a valid token through to the business route', async () => {
    const response = await request(httpServer(app))
      .get(AVAILABILITY_OF_UNKNOWN_PROGRAM)
      .set('Authorization', bearer(await validToken()))
      .expect(404);

    expect(errorBodyOf(response).code).toBe('PROGRAM_NOT_FOUND');
  });

  it('[AC-35] should serve liveness, readiness and the API documentation without a token and without business data', async () => {
    for (const path of HEALTH_AND_DOCS) {
      await request(httpServer(app)).get(path).expect(200);
    }

    const liveness = await request(httpServer(app)).get('/health').expect(200);
    const readiness = await request(httpServer(app)).get('/health/ready').expect(200);
    expect(JSON.stringify(liveness.body)).not.toMatch(PROGRAM_WORDS);
    expect(JSON.stringify(readiness.body)).not.toMatch(PROGRAM_WORDS);
  });
});
