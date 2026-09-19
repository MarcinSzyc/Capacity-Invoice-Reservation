import {HttpStatus, INestApplication} from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import type {Request, Response} from 'express';
import {INTERNAL_ERROR_CODE} from '../filters/error-body';

export const OPENAPI_JSON_PATH = 'openapi.json';
export const SWAGGER_UI_PATH = 'docs';
export const REDOC_PATH = 'redoc';
const REDOC_BUNDLE_PATH = `/${REDOC_PATH}/redoc.standalone.js`;

// Served from node_modules rather than a CDN: "runnable locally" (A-17) has to hold on a
// laptop with no network, and Swagger UI already ships its assets with the service.
const redocBundleFile = (): string => require.resolve('redoc/bundles/redoc.standalone.js');

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

  const http = app.getHttpAdapter();

  // These two sit on the adapter rather than in a controller, so the global exception filter
  // never sees them. Without this, a missing bundle would fall through to the Express default
  // handler, which answers HTML with a stack trace outside production (CLAUDE.md §2: one
  // envelope, and 5xx never leaks internals).
  http.get(REDOC_BUNDLE_PATH, (_request: Request, response: Response) => {
    try {
      response.sendFile(redocBundleFile(), (error: unknown) => {
        if (error) failWithEnvelope(response);
      });
    } catch {
      failWithEnvelope(response);
    }
  });

  http.get(`/${REDOC_PATH}`, (_request: Request, response: Response) =>
    response.type('html').send(redocPage()),
  );
};

const failWithEnvelope = (response: Response): void => {
  if (response.headersSent) return;
  response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: INTERNAL_ERROR_CODE,
    message: 'Internal server error',
  });
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
    <script src="${REDOC_BUNDLE_PATH}"></script>
  </body>
</html>
`;
