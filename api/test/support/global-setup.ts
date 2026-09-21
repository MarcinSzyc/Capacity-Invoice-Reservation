import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PostgreSqlContainer, StartedPostgreSqlContainer} from '@testcontainers/postgresql';
import {POSTGRES_IMAGE, KAFKA_IMAGE} from './images';
import {startKafkaContainer, StartedKafka} from './kafka-container';

export interface TestInfrastructure {
  readonly postgres: StartedPostgreSqlContainer;
  readonly kafka: StartedKafka;
}

declare global {
  var testInfrastructure: TestInfrastructure | undefined;
}

const DATABASE = 'capacity';
const USERNAME = 'capacity';
const PASSWORD = 'capacity';
const API_ROOT = resolve(__dirname, '..', '..');
// The same secret the e2e helper mints tokens with (ADR-0005). Wrongly signed tokens use another.
export const TEST_JWT_SECRET = 'test-secret-for-the-e2e-suite-only';

/** ADR-0002: the tests run against the migrated schema, exactly as the container does at boot. */
const migrate = (databaseUrl: string): void => {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: {...process.env, DATABASE_URL: databaseUrl},
    stdio: 'inherit',
  });
};

export default async function globalSetup(): Promise<void> {
  const [postgres, kafka] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase(DATABASE)
      .withUsername(USERNAME)
      .withPassword(PASSWORD)
      .start(),
    startKafkaContainer(KAFKA_IMAGE),
  ]);

  migrate(postgres.getConnectionUri());

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.KAFKA_BROKERS = kafka.brokers;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  globalThis.testInfrastructure = {postgres, kafka};
}
