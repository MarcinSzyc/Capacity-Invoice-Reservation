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
import {CLOCK, Clock} from '../../src/modules/capacity/domain/ports/clock';

export interface TestAppOptions {
  readonly config?: Partial<AppConfig>;
  /** Where the application's JSON log lines go, so a test can read them back (AC-40). */
  readonly logOutput?: Writable;
  /** Where "now" comes from, so a test can stamp `createdAt` at a chosen moment (S-06). */
  readonly clock?: Clock;
}

const buildApp = async (
  config: AppConfig,
  {logOutput, clock}: Omit<TestAppOptions, 'config'> = {},
): Promise<INestApplication> => {
  const builder = Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(APP_CONFIG)
    .useValue(config);
  if (logOutput !== undefined) {
    builder.overrideProvider(JsonLogger).useValue(new JsonLogger(logOutput));
  }
  if (clock !== undefined) builder.overrideProvider(CLOCK).useValue(clock);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({logger: false});
  configureApp(app, config);
  // Listen on an ephemeral port rather than only `init()`. supertest opens its own listener for
  // any app that is not listening and closes it again when that one request finishes
  // (`supertest/lib/test.js`, `serverAddress` and `end`). Under INV-01's parallel burst the
  // fastest response then closes the listener while sibling connections are still in the accept
  // queue, and those are reset before the server ever sees them: `read ECONNRESET`, with no
  // request line in the log. Listening here keeps one stable port per app for its whole life.
  await app.listen(0);
  return app;
};

export const createAppWithConfig = (
  overrides: Partial<AppConfig> = {},
): Promise<INestApplication> => buildApp({...loadConfig(process.env), ...overrides});

export const createAppWith = ({
  config = {},
  ...options
}: TestAppOptions): Promise<INestApplication> =>
  buildApp({...loadConfig(process.env), ...config}, options);

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
