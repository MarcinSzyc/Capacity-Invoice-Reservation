import {INestApplication} from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import type {Request, Response} from 'express';

export const OPENAPI_JSON_PATH = 'openapi.json';
export const SWAGGER_UI_PATH = 'docs';
export const REDOC_PATH = 'redoc';

const REDOC_BUNDLE = 'https://cdn.redocly.com/redoc/latest/bundles/redoc.standalone.js';

/**
 * A-16: one OpenAPI document, two renderers. Swagger UI is for trying requests, Redoc for
 * reading the contract. Neither is served in production.
 */
export const setupDocs = (app: INestApplication): void => {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Program Capacity & Invoice Reservation')
      .setDescription(
        'Capacity ledger for invoice financing programs: reservations draw from a program ' +
          'credit limit, releases return capacity, the treasury reconciles over Kafka.',
      )
      .setVersion('0.1.0')
      .addBearerAuth({type: 'http', scheme: 'bearer', bearerFormat: 'JWT'})
      .build(),
  );

  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {jsonDocumentUrl: OPENAPI_JSON_PATH});

  app
    .getHttpAdapter()
    .get(`/${REDOC_PATH}`, (_request: Request, response: Response) =>
      response.type('html').send(redocPage()),
    );
};

const redocPage = (): string => `<!doctype html>
<html>
  <head>
    <title>Program Capacity & Invoice Reservation, API contract</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body {margin: 0; padding: 0;}</style>
  </head>
  <body>
    <redoc spec-url="/${OPENAPI_JSON_PATH}"></redoc>
    <script src="${REDOC_BUNDLE}"></script>
  </body>
</html>
`;
