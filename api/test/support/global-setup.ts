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

export default async function globalSetup(): Promise<void> {
  const [postgres, kafka] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase(DATABASE)
      .withUsername(USERNAME)
      .withPassword(PASSWORD)
      .start(),
    startKafkaContainer(KAFKA_IMAGE),
  ]);

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.KAFKA_BROKERS = kafka.brokers;
  process.env.NODE_ENV = 'test';

  globalThis.testInfrastructure = {postgres, kafka};
}
