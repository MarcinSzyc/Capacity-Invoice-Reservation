import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {KAFKA_IMAGE, POSTGRES_IMAGE} from './images';

const COMPOSE_FILE = resolve(__dirname, '..', '..', '..', 'docker-compose.yml');

const compose = (): string => readFileSync(COMPOSE_FILE, 'utf8');

describe('Test images', () => {
  // ADR-0004: "the compose file and the Testcontainers images must name the same Postgres and
  // Kafka versions so that works in tests means works in compose". A comment cannot enforce it.
  it('should name the same images that docker-compose.yml runs', () => {
    const services = compose();

    expect(services).toContain(`image: ${POSTGRES_IMAGE}`);
    expect(services).toContain(`image: ${KAFKA_IMAGE}`);
  });
});
