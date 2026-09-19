import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {configureApp} from './app-setup';
import {JsonLogger} from './common/logging/json-logger';
import {APP_CONFIG, AppConfig} from './config/config.module';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, {bufferLogs: true});
  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`api is listening on port ${config.port} in the ${config.profile} profile`, 'Boot');
};

void bootstrap();
