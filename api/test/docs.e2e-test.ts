import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {createProductionApp, createTestApp, httpServer} from './support/test-app';

const DOCUMENTATION_PATHS = ['/openapi.json', '/openapi.yaml', '/docs', '/redoc'];
// A rate is a decimal string on the wire, never a JSON number (ADR-0006, INV-08).
const STRING_FIELDS_BY_SCHEMA: Record<string, readonly string[]> = {
  ReserveRequestDto: ['rate'],
  ReservationDto: ['rate'],
};

const MONEY_FIELDS_BY_SCHEMA: Record<string, readonly string[]> = {
  AvailabilityDto: ['limit', 'reserved', 'available'],
  ReserveRequestDto: ['invoiceAmount'],
  ReservationDto: ['invoiceAmount', 'reservedAmount', 'held'],
};

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

    it('[INV-08] should publish rate as a string and every amount as an integer (ADR-0006)', async () => {
      const response = await request(httpServer(app)).get('/openapi.json').expect(200);
      const document = response.body as OpenApiDocument;

      for (const [schema, fields] of Object.entries(MONEY_FIELDS_BY_SCHEMA)) {
        const properties = document.components?.schemas?.[schema]?.properties ?? {};
        for (const field of fields) {
          expect(`${schema}.${field}: ${properties[field]?.type ?? 'missing'}`).toBe(
            `${schema}.${field}: integer`,
          );
        }
      }
      for (const [schema, fields] of Object.entries(STRING_FIELDS_BY_SCHEMA)) {
        const properties = document.components?.schemas?.[schema]?.properties ?? {};
        for (const field of fields) {
          expect(`${schema}.${field}: ${properties[field]?.type ?? 'missing'}`).toBe(
            `${schema}.${field}: string`,
          );
        }
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
