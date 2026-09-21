import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createProductionApp, createTestApp, httpServer} from './support/test-app';

const DOCUMENTATION_PATHS = ['/openapi.json', '/openapi.yaml', '/docs', '/redoc'];

describe('API documentation by profile', () => {
  describe('outside production', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should serve every documentation view without a token', async () => {
      for (const path of DOCUMENTATION_PATHS) {
        await request(httpServer(app)).get(path).expect(200);
      }
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

    it('should serve no documentation view at all (A-16)', async () => {
      for (const path of DOCUMENTATION_PATHS) {
        await request(httpServer(app)).get(path).expect(404);
      }
    });

    it('should still answer liveness, which is not a documentation view', async () => {
      await request(httpServer(app)).get('/health').expect(200);
    });
  });
});
