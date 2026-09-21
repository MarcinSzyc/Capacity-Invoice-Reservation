# Plan

The list of every requirement and where it stands. One row per acceptance criterion and
per invariant from [[../spec/acceptance-criteria]] and [[../spec/invariants]]. Written by
`/plan` (id, slice, test name, level), completed by `/ship` (test file, commit, status).
Slices themselves live in [[../slices/README]], one file each.

Status: `planned`, `in progress`, `done`, `superseded by <id>`.

| Id | Slice | Status | Test name | Level | Test file | Commit |
|---|---|---|---|---|---|---|
| AC-00 | S-01 | done | `[AC-00] should start with docker compose up, turn ready and answer GET /health and both documentation views without a token` | cold start | `api/test/cold-start/stack.smoke-test.ts` | `4215d1c` (tag `S-01`) |
| AC-01 | S-03 | planned | `[AC-01] should reserve within capacity and show the amounts, active status and reduced availability` | e2e | | |
| AC-02 | S-03 | planned | `[AC-02] should reserve exactly the remaining capacity and leave availability at zero` | e2e | | |
| AC-03 | S-03 | planned | `[AC-03] should reject a reservation that exceeds available capacity with CAPACITY_EXCEEDED and the available amount` | e2e | | |
| AC-04 | S-03 | planned | `[AC-04] should answer 404 PROGRAM_NOT_FOUND for a reservation on an unknown program` | e2e | | |
| AC-05 | S-03 | planned | `[AC-05] should answer 409 RESERVATION_ALREADY_EXISTS with the existing reservation for a repeated invoice` | e2e | | |
| AC-06 | S-04 | planned | `[AC-06] should convert a EUR invoice at the given rate, store the rate and reduce availability by the converted amount` | e2e | | |
| AC-07 | S-04 | planned | `[AC-07] should answer 400 naming rate when it is missing for a cross-currency reservation or not 1 for a same-currency one` | e2e | | |
| AC-08 | S-03 | planned | `[AC-08] should answer 400 naming the field for a non-positive, non-integer or non-ISO-4217 reservation` | e2e | | |
| AC-09 | S-03 | planned | `[AC-09] should reject any reservation on an overcommitted program with CAPACITY_EXCEEDED and available 0` | e2e | | |
| AC-10 | S-05 | planned | `[AC-10] should apply a partial release in invoice currency, reduce held by the converted amount and grow availability` | e2e | | |
| AC-11 | S-05 | planned | `[AC-11] should close the reservation when the release carries no amount` | e2e | | |
| AC-12 | S-05 | planned | `[AC-12] should close exactly at zero when the final instalment does not divide evenly by the rate` | e2e | | |
| AC-13 | S-05 | planned | `[AC-13] should reject a release beyond held with RELEASE_EXCEEDS_HELD and change nothing` | e2e | | |
| AC-14 | S-05 | planned | `[AC-14] should answer 404 RESERVATION_NOT_FOUND for a release on an unknown invoice` | e2e | | |
| AC-15 | S-05 | planned | `[AC-15] should answer 409 RESERVATION_ALREADY_RELEASED for a new releaseId on a closed reservation` | e2e | | |
| AC-16 | S-05 | planned | `[AC-16] should answer 409 RELEASE_ALREADY_PROCESSED with the original outcome for a repeated releaseId` | e2e | | |
| AC-17 | S-05 | planned | `[AC-17] should record the release reason on the movement, defaulting to repaid, without changing the effect` | e2e | | |
| AC-18 | S-05 | planned | `[AC-18] should reflect a reservation and a release in availability immediately after the response` | e2e | | |
| AC-19 | S-05 | planned | `[AC-19] should return the reservation with its amounts, rate, status, source and movements` | e2e | | |
| AC-20 | S-02 | done | `[AC-20] should create the program from the first capacity update and expose its availability` | e2e | `api/test/programs.e2e-test.ts` | |
| AC-21 | S-03 | planned | `[AC-21] should raise available when the treasury raises the limit above current usage` | e2e | | |
| AC-22 | S-03 | planned | `[AC-22] should read available 0 and overcommitted true when the limit drops below usage while every held stays` | e2e | | |
| AC-23 | S-02 | done | `[AC-23] should record a repeated messageId as duplicate and change nothing` | contract | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.integration-test.ts` | |
| AC-24 | S-02 | done | `[AC-24] should keep the newer limit and record an older eventTime update as stale` | contract | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.integration-test.ts` | |
| AC-25 | S-02 | done | `[AC-25] should dead-letter a malformed message, log it and apply the next valid one` | contract | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.integration-test.ts` | |
| AC-26 | S-06 | planned | `[AC-26] should add an unknown reservation from the snapshot with source reconciliation and an adjustment movement` | e2e | | |
| AC-27 | S-06 | planned | `[AC-27] should release by adjustment a reservation created before asOf that the snapshot omits` | e2e | | |
| AC-28 | S-06 | planned | `[AC-28] should keep a reservation created after asOf that the snapshot omits` | e2e | | |
| AC-29 | S-06 | planned | `[AC-29] should correct held to the snapshot value with an adjustment for the difference` | e2e | | |
| AC-30 | S-06 | planned | `[AC-30] should ignore a snapshot older than the last applied one and record it as stale` | contract | | |
| AC-31 | S-06 | planned | `[AC-31] should set limit and currency from the snapshot and expose its asOf in availability` | e2e | | |
| AC-32 | S-02 | done | `[AC-32] should answer 401 to a business request without a bearer token` | e2e | `api/test/authentication.e2e-test.ts` | |
| AC-33 | S-02 | done | `[AC-33] should answer 401 to an expired or wrongly signed token` | e2e | `api/test/authentication.e2e-test.ts` | |
| AC-34 | S-05 | planned | `[AC-34] should record the authenticated client id on reserve and release movements` | e2e | | |
| AC-35 | S-02 | done | `[AC-35] should serve liveness, readiness and the API documentation without a token and without business data` | e2e | `api/test/authentication.e2e-test.ts` | |
| AC-36 | S-02 | done | `[AC-36] should start from a clean checkout and answer an authenticated availability request for the sample program` | cold start | `api/test/cold-start/programs.smoke-test.ts` | |
| AC-37 | S-02 | done | `[AC-37] should mint a dev token that the availability request accepts` | cold start | `api/test/cold-start/programs.smoke-test.ts` | |
| AC-38 | S-07 | planned | `[AC-38] should serve the demo page in the dev profile with generator, request log, ledger and treasury panel, and not in production` | e2e | | |
| AC-39 | S-07 | planned | `[AC-39] should read the same availability and reservations after a restart` | e2e | | |
| AC-40 | S-02 | done | `[AC-40] should write JSON log lines sharing one correlation id per request and per message` | e2e | `api/test/programs.e2e-test.ts` | |
| AC-41 | S-01 | done | `[AC-41] should link the README to the assumptions register, the decision records and the run instructions` | unit | `api/test/readme.test.ts` | `4215d1c` (tag `S-01`) |
| INV-01 | S-03 | planned | `[INV-01] should never overcommit under parallel reservations on one program` | invariant (e2e) | | |
| INV-02 | S-05 | planned | `[INV-02] should keep held between 0 and reservedAmount over random release sequences` | unit | | |
| INV-03 | S-03 | planned | `[INV-03] should keep program reserved equal to the sum of held of active reservations after every scenario` | invariant (e2e) | | |
| INV-04 | S-03 | planned | `[INV-04] should chain reserved_after from the previous row plus delta_held and recompute the stored state` | unit + e2e helper | | |
| INV-05 | S-06 | planned | `[INV-05] should leave every balance and ledger row unchanged when every message and request of a scenario is replayed` | invariant (e2e) | | |
| INV-06 | S-06 | planned | `[INV-06] should never alter a reservation by a snapshot whose asOf precedes its creation` | invariant (e2e) | | |
| INV-07 | S-06 | planned | `[INV-07] should reach the same final state for shuffled and reversed message order as for in-order delivery` | invariant (contract) | | |
| INV-08 | S-04 | planned | `[INV-08] should keep money as integer minor units with a currency, refuse cross-currency arithmetic and round conversions half up` | unit | | |
| INV-09 | S-03 | planned | `[INV-09] should reject a movement that carries neither clientId nor messageId` | integration | | |
| INV-10 | S-02 | done | `[INV-10] should answer 401 on every business route without a token` | invariant (e2e) | `api/test/business-routes-guarded.e2e-test.ts` | |
| INV-11 | S-03 | planned | `[INV-11] should keep available between 0 and limit over random sequences of reservations and limit changes` | unit | | |

## Tests beyond the plan

Written during a slice and not named by `/plan`, kept here so the traceability table is the
whole picture. Marked `extra`: they prove the harness, infrastructure or a standard rather
than closing a requirement of their own (`CLAUDE.md §4`).

| Slice | Status | What it proves | Test file |
|---|---|---|---|
| S-01 | extra | The configuration loader reads a complete environment, names every missing variable at once, rejects an unknown profile, a non-numeric or out of range port and a blank web origin, and defaults what may default | `api/src/config/configuration.test.ts` |
| S-01 | extra | A readiness probe that never answers, answers late or throws counts as unreachable, and a fast probe does not wait out its bound | `api/src/health/probe-within.test.ts` |
| S-01 | extra | The JSON logger survives a `bigint` message (money, ADR-0001), logs an `Error` by its message and never writes an empty line | `api/src/common/logging/json-logger.test.ts` |
| S-01 | extra | The database connection opens against a real PostgreSQL, reports itself reachable, reports itself unreachable when the database is not there, and survives a database that is missing at module start | `api/src/persistence/prisma.service.integration-test.ts` |
| S-01 | extra | Liveness answers without a token, readiness reports both dependencies up, the correlation id the caller sends is echoed, and an unknown route answers with the error envelope | `api/test/health.e2e-test.ts` |
| S-01 | extra | Readiness answers `503` naming the dependency that is down, for the broker and for the database, while liveness still answers `200` | `api/test/readiness.e2e-test.ts` |
| S-01 | extra | Both documentation views and the OpenAPI document are served outside production and none of them in the production profile (A-16) | `api/test/docs.e2e-test.ts` |
| S-02 | extra | `Money` holds integer minor units with a currency, adds, subtracts and compares in one currency only, refuses two currencies and a negative amount (ADR-0006) | `api/src/modules/capacity/domain/money.test.ts` |
| S-02 | extra | `Program` is announced empty, applies a first limit as one `limit_set` movement, keeps the newer limit over an older `eventTime`, reads `available` zero and `overcommitted` when the limit drops below reserved, re-denominates an empty program and refuses another currency with something held (ADR-0007) | `api/src/modules/capacity/domain/program.test.ts` |
| S-02 | extra | `ApplyCapacityUpdate` creates, counts a duplicate, records stale, returns `rejected` on a currency mismatch without recording and re-denominates an empty program, all against in-memory fakes | `api/src/modules/capacity/application/apply-capacity-update.use-case.test.ts` |
| S-02 | extra | `RejectTreasuryMessage` dead-letters before it records, counts a known id without publishing and leaves no record when the publish fails | `api/src/modules/capacity/application/reject-treasury-message.use-case.test.ts` |
| S-02 | extra | `GetAvailability` returns the announced program or throws `PROGRAM_NOT_FOUND` | `api/src/modules/capacity/application/get-availability.query.test.ts` |
| S-02 | extra | The JWT verifier accepts the configured secret and rejects expired, wrongly signed, unsigned, subject-less, expiry-less and wrong issuer or audience tokens (ADR-0005) | `api/src/common/auth/jose-token-verifier.test.ts` |
| S-02 | extra | Configuration requires `JWT_SECRET`, refuses the development secret in production and reads issuer and audience | `api/src/config/configuration.test.ts` |
| S-02 | extra | The logger writes to an injected stream, and library log lines can step outside the correlation context | `api/src/common/logging/json-logger.test.ts`, `api/src/common/logging/correlation-id.test.ts` |
| S-02 | extra | The message DTO maps a valid update to a typed command, reads an offset as the same instant, refuses a zone-less time, a wrong shape and an unknown field | `api/src/modules/capacity/infrastructure/messaging/capacity-update-message.dto.test.ts` |
| S-02 | extra | A rejected payload's ids are read only when they fit the store's columns | `api/src/modules/capacity/infrastructure/messaging/readable-payload.test.ts` |
| S-02 | extra | The consumer dead-letters before recording on both rejection paths, retries after a failed publish and counts a malformed repeat of a known id without publishing | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.test.ts` |
| S-02 | extra | Prisma adapters round-trip a program, append and read the ledger in order, record a message once and count repeats, roll back on throw and serialise two units of work on the row lock (ADR-0002) | `api/src/modules/capacity/infrastructure/persistence/prisma-capacity.integration-test.ts` |
| S-02 | extra | `KafkaService` delivers a published message with key, value and headers, commits the offset after the handler, and leaves the offset uncommitted when the handler fails (ADR-0003) | `api/src/messaging/kafka.service.integration-test.ts` |
| S-02 | extra | Over the real broker: a currency change re-denominates an empty program and is dead-lettered on a busy one (ADR-0007), an unknown type, a non JSON body and an over-long `messageId` are dead-lettered and the next valid update still applies | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.integration-test.ts` |
| S-02 | extra | A non-bearer `Authorization` header answers 401 and a valid token reaches the business route | `api/test/authentication.e2e-test.ts` |
| S-02 | extra | An unknown program answers 404 `PROGRAM_NOT_FOUND` and an overlong program id answers 400 `VALIDATION_FAILED` | `api/test/programs.e2e-test.ts` |
| S-02 | extra | The OpenAPI document publishes every money field as `integer` and serves the YAML document too (ADR-0006) | `api/test/docs.e2e-test.ts` |
| S-01 | extra | CORS allows the `web` origin in the dev profile and no origin in production | `api/test/cors.e2e-test.ts` |
| S-01 | extra | Compose and Testcontainers name the same PostgreSQL and Kafka images, so drift fails the gate (ADR-0004) | `api/test/support/images.test.ts` |
| S-01 | extra | The `web` page renders its heading and links to the health endpoint and both documentation views of the api | `web/src/app.test.tsx` |
