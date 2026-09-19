import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createAppWithBrokerDown, createAppWithDatabaseDown, httpServer} from './support/test-app';

describe('Readiness when a dependency is down', () => {
  describe('the broker does not answer', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createAppWithBrokerDown();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should answer 503 naming the broker as the check that is down', async () => {
      const response = await request(httpServer(app)).get('/health/ready').expect(503);

      expect(response.body).toEqual({
        status: 'degraded',
        checks: {database: 'up', broker: 'down'},
      });
    });

    it('should still answer liveness with 200, because the process itself is fine', async () => {
      const response = await request(httpServer(app)).get('/health').expect(200);

      expect(response.body).toEqual({status: 'ok'});
    });
  });

  describe('the database does not answer', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createAppWithDatabaseDown();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should boot anyway and answer 503 naming the database as the check that is down', async () => {
      const response = await request(httpServer(app)).get('/health/ready').expect(503);

      expect(response.body).toEqual({
        status: 'degraded',
        checks: {database: 'down', broker: 'up'},
      });
    });

    it('should still answer liveness with 200', async () => {
      const response = await request(httpServer(app)).get('/health').expect(200);

      expect(response.body).toEqual({status: 'ok'});
    });
  });
});
