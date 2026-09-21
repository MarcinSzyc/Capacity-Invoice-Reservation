import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createProductionApp, createTestApp, httpServer} from './support/test-app';

const DOCUMENTATION_PATHS = ['/openapi.json', '/openapi.yaml', '/docs', '/redoc'];
const MONEY_FIELDS = ['limit', 'reserved', 'available'];

interface OpenApiDocument {
  readonly components?: {
    readonly schemas?: Record<
      string,
      {readonly properties?: Record<string, {readonly type?: string}>} | undefined
    >;
  };
}

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

    it('should publish every money field as an integer, never a number (ADR-0006)', async () => {
      const response = await request(httpServer(app)).get('/openapi.json').expect(200);
      const document = response.body as OpenApiDocument;
      const availability = document.components?.schemas?.AvailabilityDto?.properties ?? {};

      for (const field of MONEY_FIELDS) {
        expect(`${field}: ${availability[field]?.type ?? 'missing'}`).toBe(`${field}: integer`);
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
