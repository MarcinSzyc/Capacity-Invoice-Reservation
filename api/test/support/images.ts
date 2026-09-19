// ADR-0004: compose and Testcontainers must name the same images, so that "works in tests"
// means "works in compose". These constants are mirrored in docker-compose.yml.
export const POSTGRES_IMAGE = 'postgres:17.11-alpine';
export const KAFKA_IMAGE = 'apache/kafka:4.3.1';
