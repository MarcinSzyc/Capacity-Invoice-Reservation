import type {Server} from 'node:http';
import type {Writable} from 'node:stream';
import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {AppModule} from '../../src/app.module';
import {configureApp} from '../../src/app-setup';
import {APP_CONFIG, AppConfig} from '../../src/config/config.module';
import {loadConfig} from '../../src/config/configuration';
import type {ErrorBody} from '../../src/common/filters/error-body';
import {JsonLogger} from '../../src/common/logging/json-logger';

export interface TestAppOptions {
  readonly config?: Partial<AppConfig>;
  /** Where the application's JSON log lines go, so a test can read them back (AC-40). */
  readonly logOutput?: Writable;
}

const buildApp = async (config: AppConfig, logOutput?: Writable): Promise<INestApplication> => {
  const builder = Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(APP_CONFIG)
    .useValue(config);
  if (logOutput !== undefined) {
    builder.overrideProvider(JsonLogger).useValue(new JsonLogger(logOutput));
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({logger: false});
  configureApp(app, config);
  await app.init();
  return app;
};

export const createAppWithConfig = (
  overrides: Partial<AppConfig> = {},
): Promise<INestApplication> => buildApp({...loadConfig(process.env), ...overrides});

export const createAppWith = ({
  config = {},
  logOutput,
}: TestAppOptions): Promise<INestApplication> =>
  buildApp({...loadConfig(process.env), ...config}, logOutput);

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

/** supertest types a body as any; the error envelope is the shape every test asserts on. */
export const errorBodyOf = (response: {body: unknown}): ErrorBody => response.body as ErrorBody;

// Nest types getHttpServer() as any, so supertest gets the shape spelled out once, here.
export const httpServer = (app: INestApplication): Server => {
  const server: unknown = app.getHttpServer();
  return server as Server;
};
