import type {Server} from 'node:http';
import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {AppModule} from '../../src/app.module';
import {configureApp} from '../../src/app-setup';
import {APP_CONFIG, AppConfig} from '../../src/config/config.module';
import {loadConfig} from '../../src/config/configuration';

const buildApp = async (config: AppConfig): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .compile();
  const app = moduleRef.createNestApplication({logger: false});
  configureApp(app, config);
  await app.init();
  return app;
};

export const createAppWithConfig = (
  overrides: Partial<AppConfig> = {},
): Promise<INestApplication> => buildApp({...loadConfig(process.env), ...overrides});

export const createTestApp = (): Promise<INestApplication> => createAppWithConfig();

/** The production profile serves no documentation view (A-16). */
export const createProductionApp = (): Promise<INestApplication> =>
  createAppWithConfig({profile: 'production'});

/** A broker address that points nowhere, so readiness has a dependency that is down. */
export const createAppWithBrokerDown = (): Promise<INestApplication> =>
  createAppWithConfig({kafkaBrokers: ['127.0.0.1:1']});

/** A database address that points nowhere, the same case for the other dependency. */
export const createAppWithDatabaseDown = (): Promise<INestApplication> =>
  createAppWithConfig({databaseUrl: 'postgresql://nobody:nobody@127.0.0.1:1/nothing'});

// Nest types getHttpServer() as any, so supertest gets the shape spelled out once, here.
export const httpServer = (app: INestApplication): Server => {
  const server: unknown = app.getHttpServer();
  return server as Server;
};
