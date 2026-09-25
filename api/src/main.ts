import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {configureApp} from './app-setup';
import {JsonLogger} from './common/logging/json-logger';
import {APP_CONFIG, AppConfig} from './config/config.module';
import {loadConfig} from './config/configuration';

const logger = new JsonLogger();

const bootstrap = async (): Promise<void> => {
  // The logger goes in at creation, not after: Nest logs a failure during creation through its
  // own handler, so anything it prints before that point would not be JSON (A-18). With
  // abortOnError it would also exit before the handler below could report the failure.
  const app = await NestFactory.create(AppModule.forProfile(loadConfig(process.env).profile), {
    logger,
    abortOnError: false,
  });

  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`api is listening on port ${config.port} in the ${config.profile} profile`, 'Boot');
};

// A boot failure is the one log line a misconfigured deployment produces, so it is JSON like
// every other line (A-18) instead of an unhandled rejection printing a raw stack.
bootstrap().catch((reason: unknown) => {
  const failure = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(failure.message, failure.stack, 'Boot');
  process.exit(1);
});
