# S-01 Walking skeleton

- Outcome: a clean checkout runs `docker compose up`, the service and its dependencies turn healthy, `GET /health` and both API documentation views answer, and `npm run gate` exists and is green.
- Status: in progress
- AC: AC-00, AC-41
- INV: none
- Risk: low. Tooling and wiring only, no business rule. The cost of a mistake is friction in every later slice, so the gate and the layer lint must be exact from day one.
- Builds on: [[../decisions/ADR-0001-technology-baseline]] (accepted): Node 24, NestJS, TypeScript strict, npm; `api/` and `web/` workspaces; compose with `api`, `web`, `db`, `kafka`.
- Depends on: nothing. ADRs that must be accepted first: [[../decisions/ADR-0002-storage-postgres-and-data-access]], [[../decisions/ADR-0003-kafka-client-and-topic-layout]], [[../decisions/ADR-0004-test-infrastructure-testcontainers]].

## Scope

What exists after this slice, nothing more:

- NestJS 12 on Node 24 LTS, TypeScript 6 `strict`, ESLint (`typescript-eslint` recommended-type-checked, `no-floating-promises: error`, `no-nested-ternary`, `max-depth: 2`, `curly: multi-line`, an import-boundary rule that forbids `@nestjs/*` and the data access library inside `src/modules/**/domain/**`), Prettier (`singleQuote`, `trailingComma: all`, `bracketSpacing: false`).
- `src/config/`: typed configuration loaded once at boot and validated; boot fails fast on a missing variable. Profile is `NODE_ENV` with values `development`, `test`, `production`.
- `src/common/`: global exception filter (envelope `{statusCode, code, message, details?}`, `5xx` bodies carry `code: INTERNAL_ERROR` and nothing else), global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), JSON logger with a per-request correlation id (`x-correlation-id` echoed or generated). The logger is infrastructure for AC-40, which closes in S-02 once Kafka messages exist too.
- Health: `GET /health` (liveness, always `200 {status: 'ok'}`), `GET /health/ready` (readiness, checks the database and the Kafka broker connection, `503` until both answer). No business data.
- API docs, served when `NODE_ENV !== 'production'`: `GET /openapi.json` (one document generated from DTO decorators), `GET /docs` (Swagger UI), `GET /redoc` (Redoc reading the same document).
- Repository layout per ADR-0001: root `package.json` with npm workspaces `api` and `web`, root scripts fanning out to both; `api/` is the NestJS project, `web/` a Vite React TypeScript project with one placeholder screen that S-07 fills; each with its own `Dockerfile`, ESLint and Prettier config following `CLAUDE.md §3`.
- `docker-compose.yml` per ADR-0001: `api` (multi-stage `Dockerfile`, Node 24), `web` (multi-stage: Vite build, then nginx serving `dist/`), `db` (Postgres, own volume), `kafka` (single broker, KRaft), `studio` (pgweb, port 5555, dev profile, ADR-0002). `docker compose up` alone brings everything up with health checks; no `.env` editing needed for the default profile. `api` allows CORS from the `web` origin in the dev profile.
- Scripts in `package.json`: `lint`, `format:check`, `typecheck`, `check:prose` (wraps `scripts/check-prose.sh`), `test` (unit), `test:integration`, `test:e2e`, `smoke` (cold start), `gate:quick`, `gate`. Husky pre-commit runs `gate:quick`.
- Test harness: Jest, three configs by file pattern (`src/**/*.test.ts`, `src/**/*.integration-test.ts`, `test/**/*.e2e-test.ts`), Testcontainers helpers under `test/support/` that start Postgres and Kafka once per e2e run, and `test/cold-start/` tests that run against `BASE_URL` of the compose stack.
- `README.md`: how to start, where health and both docs views are, links to assumptions, ADRs and Home.

No module under `src/modules/` yet. No authentication yet (S-02). No tables yet beyond what the data access library needs to connect.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-00] should start with docker compose up, turn ready and answer GET /health and both documentation views without a token')` | cold start | `test/cold-start/`. Runs after `docker compose up --wait` in `npm run smoke`. Asserts `/health` 200, `/health/ready` 200, `/openapi.json` is a valid OpenAPI 3 document, `/docs` and `/redoc` return HTML, and the `web` container answers `200` with HTML on its port. The gate scripts existing and passing is proven by the gate itself. |
| `it('[AC-41] should link the README to the assumptions register, the decision records and the run instructions')` | unit | `test/readme.test.ts`. Reads `README.md`, asserts the three links exist and resolve to files. `/ship` keeps it true at every slice. |

Supporting tests without a tag, needed so every level of the harness runs at least once: a unit test of the config loader (missing variable fails boot), an e2e test that `GET /health` answers `200` through supertest, an integration test that the database connection opens against a Testcontainers Postgres.

## ADR candidates

Decided before this slice starts, all three drafted:

- [[../decisions/ADR-0001-technology-baseline]]: accepted; fixes the runtime, the two workspaces, the four compose services and the `web` stack this slice scaffolds. Nothing left to decide here.
- [[../decisions/ADR-0002-storage-postgres-and-data-access]]: PostgreSQL is a given for row locks and BIGINT; the data access library is the choice.
- [[../decisions/ADR-0003-kafka-client-and-topic-layout]]: client library (kafkajs, Confluent's client, Nest microservices transport) and one topic vs two.
- [[../decisions/ADR-0004-test-infrastructure-testcontainers]]: Testcontainers vs the compose stack for integration and e2e; test runner.

## Definition of done

Beyond `CLAUDE.md §9`:

- `npm run gate` green on a clean checkout and in CI (the CI gate job stops skipping itself once `package.json` exists).
- `docker compose down -v && docker compose up --wait` succeeds from scratch in under two minutes on a laptop.
- The import-boundary lint rule fails on a deliberately wrong import (checked by hand once, noted in the work-log).

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-19 | plan (revision) | compose shape per ADR-0001: api, web, db, kafka; demo in the web container |
| 2026-09-19 | implement | slice started, branch `slice/S-01-walking-skeleton` |
| 2026-09-19 | implement | walking skeleton built test first, `npm run gate` green from a clean install |
| 2026-09-19 | verify | PASS, gate green, 2/2 AC covered, no findings |
| 2026-09-19 | review | 11 findings (1 blocker, 3 majors, 7 minors), returned to `/implement` |
| 2026-09-19 | implement (review fixes) | 9 findings fixed, 1 pushed back, 1 handed to `/spec`; gate green |
