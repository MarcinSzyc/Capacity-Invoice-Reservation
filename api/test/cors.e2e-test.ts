import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createAppWithConfig, createProductionApp, httpServer} from './support/test-app';

const WEB_ORIGIN = 'http://localhost:8080';
const ALLOW_ORIGIN = 'access-control-allow-origin';

describe('CORS by profile', () => {
  describe('outside production', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createAppWithConfig({webOrigin: WEB_ORIGIN});
    });

    afterAll(async () => {
      await app.close();
    });

    it('should allow the web origin the slice scope names', async () => {
      const response = await request(httpServer(app))
        .get('/health')
        .set('Origin', WEB_ORIGIN)
        .expect(200);

      expect(response.headers[ALLOW_ORIGIN]).toBe(WEB_ORIGIN);
    });
  });

  describe('in the production profile', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createProductionApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should allow no origin at all, because web is not deployed there', async () => {
      const response = await request(httpServer(app))
        .get('/health')
        .set('Origin', WEB_ORIGIN)
        .expect(200);

      expect(response.headers[ALLOW_ORIGIN]).toBeUndefined();
    });
  });
});
