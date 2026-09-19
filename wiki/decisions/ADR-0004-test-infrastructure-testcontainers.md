# ADR-0004: Test infrastructure for integration and e2e tests

- Status: proposed
- Date: 2026-09-19
- Slice: S-01
- Related: AC-00, AC-36, `wiki/testing/strategy.md`

## Context

Integration tests need a real Postgres and a real Kafka; e2e tests need the whole app against
both; the cold start smoke needs the compose stack itself. `gate:quick` runs on every commit
through the pre-commit hook, so integration tests must start their infrastructure fast and
leave nothing behind. CI runs on GitHub Actions with Docker available.

## Options

### Option 1: Testcontainers for integration and e2e, compose only for the cold start smoke
Each Jest run starts one Postgres and one Kafka container (global setup), tests get isolated
schemas or fresh programs, containers are removed at the end. Pros: hermetic, parallel-safe,
identical locally and in CI, no "did you start compose" failures. Cons: 20 to 40 seconds of
container start per run; Docker required for `gate:quick`.

### Option 2: The compose stack for everything
Tests point at `localhost` ports of the running compose services. Pros: nothing to start
twice, fastest iteration. Cons: state leaks between runs, developers must remember to start
compose, CI needs the same compose up step, the e2e tests then depend on the app image being
rebuilt.

### Option 3: Postgres and Kafka in-process fakes for integration, containers for e2e only
Pros: fast quick gate. Cons: an in-memory Postgres or Kafka is not the real thing; the
repositories and the consumer are exactly the code that must be proven against reality.

### Test runner
Jest (NestJS default, ts-jest or `@swc/jest` for speed) or Vitest. Recommendation: Jest,
because every NestJS testing example and the `@nestjs/testing` utilities assume it and the
team's other backend uses it.

## Recommendation

Option 1 with Jest. Three Jest projects (unit, integration, e2e) by file pattern; Testcontainers
global setup shared by integration and e2e; the cold start smoke is a fourth, tiny Jest project
under `test/cold-start/` that targets `BASE_URL` and is run by `npm run smoke` after
`docker compose up --wait`.

## Decision

(empty until Marcin decides)

## Consequences

Docker is a prerequisite for committing (the pre-commit hook runs integration tests). The
compose file and the Testcontainers images must name the same Postgres and Kafka versions so
"works in tests" means "works in compose".
