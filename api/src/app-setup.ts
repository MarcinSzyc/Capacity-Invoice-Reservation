import {INestApplication, ValidationPipe} from '@nestjs/common';
import {AllExceptionsFilter} from './common/filters/all-exceptions.filter';
import {JsonLogger} from './common/logging/json-logger';
import {correlationIdMiddleware} from './common/logging/correlation-id';
import {setupDocs} from './common/docs/setup-docs';
import type {AppConfig} from './config/config.module';

/**
 * Everything that turns the module graph into the running HTTP application, shared by `main.ts`
 * and the e2e tests so that both exercise the same pipeline.
 */
export const configureApp = (app: INestApplication, config: AppConfig): void => {
  app.use(correlationIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true}),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(JsonLogger)));

  if (config.profile === 'production') return;

  app.enableCors({origin: config.webOrigin});
  setupDocs(app);
};
