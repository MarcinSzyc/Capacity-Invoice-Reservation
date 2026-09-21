# S-02 Programs from the treasury

- Outcome: the treasury creates and updates a program over Kafka, an authenticated client reads its availability over HTTP, and a clean checkout reaches that state with the documented commands.
- Status: in progress
- AC: AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40
- INV: INV-10
- Risk: medium. It fixes the persistence model (programs, ledger with running balances, treasury message store) and the consumer's idempotency and staleness rules that every later slice relies on. No concurrency between clients yet and no money arithmetic beyond storing a limit. Foundations are set by the ADRs, so implementation risk is contained.
- Depends on: S-01. ADRs that must be accepted first: [[../decisions/ADR-0005-authentication-bearer-jwt]], [[../decisions/ADR-0006-money-and-rate-representation]], [[../decisions/ADR-0007-program-currency-change-from-treasury]] (plus ADR-0002 to ADR-0004 from S-01).

## Scope

Module `src/modules/capacity/` (one module for programs, reservations and the ledger; splitting later is a refactor, not a plan change).

Domain (`domain/`):
- `Money` value object: integer minor units (`bigint`) plus ISO 4217 code; `add`, `subtract`, `compare` only for the same currency, anything else throws a domain error. Conversion arrives in S-04.
- `Program` aggregate: `programId`, `currency`, `limit`, `reserved` (zero in this slice), `limitEventTime`, `asOf` (null until S-06). `setLimit(limit, eventTime, messageId)` returns either a `limit_set` movement or a `stale` outcome. `available = max(0, limit - reserved)`, `overcommitted = reserved > limit`.
- `CapacityMovement`: kind (`limit_set` only used here, the enum has all four), `deltaHeld`, `limitAfter`, `reservedAfter`, `availableAfter`, `clientId | messageId`, `occurredAt`.
- Ports: `ProgramRepository` (`findById`, `save`, `lockById` inside a unit of work), `TreasuryMessageStore` (`recordOutcome`, `wasProcessed`), `LedgerRepository` (`append`), `UnitOfWork` (`run(fn)`, one transaction).
- Domain errors: `ProgramNotFound`.

Application (`application/`):
- `ApplyCapacityUpdate` use case: inside one transaction, lock or create the program, check `messageId` (duplicate), compare `eventTime` (stale), apply `setLimit`, append the movement, record the message outcome. Outcomes: `applied`, `duplicate`, `stale`.
- `GetAvailability` query: program by id or `ProgramNotFound`.

Infrastructure (`infrastructure/`):
- Postgres schema (migration): `programs(program_id PK, currency, credit_limit BIGINT, reserved BIGINT, limit_event_time, as_of NULL, updated_at)`, `capacity_movements(id, program_id FK, reservation_id NULL, kind, delta_held BIGINT, limit_after, reserved_after, available_after, client_id NULL, message_id NULL, release_id NULL, reason NULL, occurred_at, CHECK (client_id IS NOT NULL OR message_id IS NOT NULL))`, `treasury_messages(message_id PK, program_id, type, payload JSONB, outcome ('applied' | 'duplicate' | 'stale' | 'rejected'), duplicate_count INT DEFAULT 0, error TEXT NULL, received_at, processed_at)`. The `reservations` table arrives in S-03.
- Kafka consumer for the treasury topic (per ADR-0003): validates the raw message against the capacity update DTO (class-validator), builds a typed command, calls the use case, commits the offset after the transaction. Malformed or unprocessable: log with full context, publish to the dead-letter topic with the original payload and the error in headers, record `rejected` when a `messageId` is readable, continue.
- Message contract (A-11), JSON, key = `programId`: `{messageId, type: 'capacity_update', programId, currency, creditLimit, eventTime}`; amounts are integer minor units, times ISO 8601 UTC. The snapshot type is defined in S-06 and rejected as unknown until then.
- Controller `GET /programs/:programId/availability` → `200 {programId, currency, limit, reserved, available, overcommitted, asOf}`; `404 PROGRAM_NOT_FOUND` for an unknown program (not an AC of its own; AC-04 covers the reserve path in S-03, add an untagged e2e test here).
- Authentication (`src/common/auth/`, per ADR-0005): global guard, bearer JWT, `sub` becomes `clientId` on the request; `@Public()` marks liveness, readiness, docs and later the demo page. `401` without a body beyond the envelope.
- Dev tooling: `npm run dev:token` mints a JWT with the configured secret (AC-37); `npm run dev:treasury -- capacity-update --program PRG-1 --currency USD --limit 1000000000` publishes a message; compose gets a one-shot `seed` service running that command once the broker is ready so the sample program `PRG-1` (10 000 000.00 USD) exists after `docker compose up` (A-05). The cold start smoke from S-01 now hits the authenticated availability endpoint with a dev token, as `CLAUDE.md §5` requires.
- Logging: the request correlation id from S-01 plus a per-message correlation id (`messageId`) on every log line of a consumed message.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-20] should create the program from the first capacity update and expose its availability')` | e2e | publish over the real broker, poll `GET /programs/PRG-2/availability` until `200`, assert 5 000 000 EUR limit, reserved 0, available 5 000 000, `overcommitted` false, `asOf` null |
| `it('[AC-23] should record a repeated messageId as duplicate and change nothing')` | contract | integration with the Kafka container: publish `m-1` twice, assert one `applied` row with `duplicate_count` 1, ledger has one `limit_set` row |
| `it('[AC-24] should keep the newer limit and record an older eventTime update as stale')` | contract | 10:05 sets 9 000 000, then 10:00 with 8 000 000 arrives, limit stays, outcome `stale` |
| `it('[AC-25] should dead-letter a malformed message, log it and apply the next valid one')` | contract | consume the dead-letter topic in the test, assert payload and error header, assert the following valid message applied |
| `it('[AC-32] should answer 401 to a business request without a bearer token')` | e2e | availability without `Authorization` |
| `it('[AC-33] should answer 401 to an expired or wrongly signed token')` | e2e | two cases: `exp` in the past, token signed with another secret |
| `it('[AC-35] should serve liveness, readiness and the API documentation without a token and without business data')` | e2e | `/health`, `/health/ready`, `/openapi.json`, `/docs`, `/redoc` all `200` with no token; health bodies contain no program data |
| `it('[AC-36] should start from a clean checkout and answer an authenticated availability request for the sample program')` | cold start | `test/cold-start/`, after `docker compose up --wait`: token from `npm run dev:token`, `GET /programs/PRG-1/availability` is `200` with limit 1 000 000 000 minor units USD |
| `it('[AC-37] should mint a dev token that the availability request accepts')` | cold start | runs the documented command through `child_process`, uses its stdout as the bearer token |
| `it('[AC-40] should write JSON log lines sharing one correlation id per request and per message')` | e2e | logger writes to an injected stream in tests; one HTTP request and one consumed message; every line of each is valid JSON and carries the same `correlationId`; the two ids differ |
| `it('[INV-10] should answer 401 on every business route without a token')` | invariant (e2e) | enumerate the routes of the running app (Nest `DiscoveryService` or the Express router stack), subtract the `@Public()` ones, call each without a token, assert `401`. The suite re-runs unchanged in every later slice. |

## ADR candidates

- [[../decisions/ADR-0005-authentication-bearer-jwt]]: HS256 shared secret vs RS256 key set; how e2e tests and the dev token obtain tokens.
- [[../decisions/ADR-0006-money-and-rate-representation]]: `bigint` in the domain, BIGINT in storage, JSON integer vs string on the API; rate as a decimal string with fixed scale. Needed now because `Money` is born here.
- [[../decisions/ADR-0007-program-currency-change-from-treasury]]: a capacity update or snapshot carrying a different currency than the program has.
- Local choice, not an ADR: the seed as a compose one-shot service versus a boot-time publisher inside the app. Recommendation: the one-shot service, because the app publishes nothing (A-03) and the demo page (S-07) reuses the same script's producer code.

## Definition of done

Beyond `CLAUDE.md §9`:

- `npm run smoke` hits an authenticated endpoint with a minted token, as `CLAUDE.md §5` requires from now on.
- README shows the three commands: start, mint a token, read availability of `PRG-1` with curl.
- The consumer survives a broker restart during the e2e run (reconnect, no duplicate application), checked by hand once and noted in the work-log.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-21 | implement | slice started, branch `slice/S-02-programs-from-the-treasury` |
| 2026-09-21 | implement | built test first, 11/11 planned tests present, `npm run gate:quick` green, e2e and smoke green, broker restart checked by hand |
| 2026-09-21 | verify | PASS, gate green on 95ed588, 10/10 AC and 1/1 INV covered at the planned level, 2 minor findings for `/ship` |
| 2026-09-21 | review | 6 findings (0/2/4): consumer rejection path writes unbounded ids into bounded columns and stalls the partition (major), glossary lacks outcome vocabulary (major, `/spec`), four minors; back to `/implement` |
| 2026-09-21 | implement (review fixes) | 4 of 6 findings fixed test first (1 major, 3 minors), glossary to `/spec`, tooling tree entry to `/ship`; `npm run gate:quick` green |
| 2026-09-21 | verify (second pass) | PASS, gate green on d9b15e7, 10/10 AC and 1/1 INV, review round 1 fixes confirmed, 2 minor findings for `/ship` |
| 2026-09-21 | review (second pass) | 6 findings (1/0/5): OpenAPI publishes the three amounts as `number` against ADR-0006 `integer` (blocker), five minors (lint gap for `common` in domain, unused `duplicate` enum value, `announce` not in glossary, repeated column widths, tooling tree entry); back to `/implement` |
| 2026-09-21 | implement (review fixes, round 2) | blocker and 3 minors fixed test first, "Announce" added to the glossary via `/spec`, tooling tree entry stays with `/ship`; `npm run gate:quick` green |
