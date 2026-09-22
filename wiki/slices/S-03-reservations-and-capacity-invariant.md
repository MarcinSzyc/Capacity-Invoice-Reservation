# S-03 Reservations and the capacity invariant

- Outcome: a client reserves capacity for an invoice in program currency, is refused when capacity is short or the invoice is already reserved, and two parallel clients can never both take the same free capacity.
- Status: in progress
- AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22
- INV: INV-01, INV-03, INV-04, INV-09, INV-11
- Risk: high. Concurrency: the core invariant of the brief (never overcommit) is decided here, under two service instances against one database. Implemented on Fable per `CLAUDE.md §8`.
- Depends on: S-02 (done 2026-09-21). ADR: [[../decisions/ADR-0008-concurrency-control-per-program]], accepted 2026-09-21, Option 1, the pessimistic row lock that S-02 already built. No other ADR is needed before `/implement`.

## Revision of 2026-09-22

The slice was first written on 2026-09-19, before any code existed. This revision reconciles
it with what S-02 shipped and with ADR-0008 as accepted, so that `/implement` runs without a
design conversation. What changed against the first version:

- The error envelope is the one S-02 shipped: business fields (`available`, `reservation`)
  sit at the top level of the error body next to `code`, and validation failures carry
  `details` as a list of messages that each start with the field name. The first version
  wrote `details.available` and `details.fields[]`, which do not exist.
- `rate` leaves this slice entirely: no field, no column, no `1` placeholder. S-04 brings the
  `Rate` value object, the column and the response field together (decision 1 below).
- A reservation in another currency than the program is `422 CURRENCY_MISMATCH` from the use
  case, not `400` from the DTO, because a DTO cannot see the program's currency (decision 2).
- The `reservations` table gets a surrogate id so that the ledger's `reservation_id` can be a
  plain foreign key in Prisma; the public identity of a reservation stays the `invoiceId`
  (decision 3).
- A `Clock` port enters with this slice, so `createdAt` is deterministic in unit tests and
  S-06 can compare it with a snapshot's `asOf` (decision 5).
- A "Carried from S-02" section lists the four minors the S-02 ship carried into this slice.

## Carried from S-02

The fourth review of S-02 closed with four minors that Marcin chose to carry rather than run
another verify and review cycle ([[../log/changelog]], S-02 row). They are the first commit of
this slice, each fixed test first, before any S-03 code:

| # | Finding | Where | Fix |
|---|---|---|---|
| C1 | The dead-letter publish runs inside the message store transaction; a slow broker can time the transaction out after the publish, so a redelivery produces a second dead letter (never a lost one) | `api/src/modules/capacity/application/reject-treasury-message.use-case.ts` | Two short units of work around the publish: the first answers the duplicate question and returns early on a known id, then the dead letter is published outside any transaction, then the second records `rejected`. The order "duplicate first, publish before record" (A-13) is unchanged; the existing use case tests pin it and one new case shows no transaction is open while publishing |
| C2 | `expect(REQUEST_CORRELATION_ID).not.toBe(messageId)` compares two constants and cannot fail | `api/test/programs.e2e-test.ts`, AC-40 test | Delete the line. The two filters above it already prove the ids are distinct in the log |
| C3 | The availability mapper hands `jsonInteger` the currency as the field label, so a range error names no field | `api/src/modules/capacity/infrastructure/http/availability.mapper.ts` | Pass the field name (`limit`, `reserved`, `available`); one unit case asserts the label |
| C4 | A stale update that also carries another currency is recorded `stale`, written down in A-13 (5) but pinned by no test | `api/src/modules/capacity/application/apply-capacity-update.use-case.test.ts` | One case: a program with a limit at 10:05, an update at 10:00 in another currency, outcome `stale`, no `rejected`, no dead letter, program unchanged. Supporting test, untagged: AC-24 already closes staleness |

## Scope

Module `src/modules/capacity/`, as in S-02. Nothing in `web` changes in this slice.

Domain (`domain/`):
- `Reservation` entity (`reservation.ts`): `reservationId` (surrogate, decision 3), `programId`,
  `invoiceId`, `invoiceAmount` (Money, invoice currency), `reservedAmount` (Money, program
  currency), `held` (Money, program currency), `source` (`client` here, `reconciliation` in S-06),
  `clientId` (`string | null`, null only for a reconciliation source), `createdAt`. `status` is
  derived, never stored: `active` when `held > 0`, `closed` when `held` is zero (glossary).
  `Reservation.open({...})` for the reserve path and `Reservation.rehydrate(state)` for
  repositories, mirroring `Program.announce` and `Program.rehydrate`. In this slice
  `reservedAmount` equals `invoiceAmount` because the currencies are equal; S-04 makes it a
  conversion.
- `Program.reserve(held, clientId, reservationId, occurredAt)`: throws `CapacityExceededError`
  when `held > available` (on an overcommitted program `available` is zero, so any positive
  amount fails: AC-09), otherwise raises `reserved` and returns a `reserve` movement with
  `deltaHeld = +held`, `reservationId` set and `{clientId}` as attribution (INV-09). The
  movement carries the balances it left behind, as `setLimit` does today.
- `Ledger.recompute(movements)` (`ledger.ts`), a pure domain service for INV-04: walks the
  rows in order, checks `reservedAfter = previous.reservedAfter + deltaHeld` (the first row
  starts from zero), `availableAfter = max(0, limitAfter - reservedAfter)`, and that
  `limitAfter` changes only on a `limit_set` row. Returns the recomputed program balances and
  `held` per `reservationId` (sum of its deltas), or a `broken` result naming the first row that
  fails and why. It never throws for a broken chain: the test helper wants the row.
- Domain errors (`errors.ts`): `CapacityExceededError` (`CAPACITY_EXCEEDED`, kind
  `unprocessable`, `details: {available}` as a `bigint`), `ReservationAlreadyExistsError`
  (`RESERVATION_ALREADY_EXISTS`, kind `conflict`, `details: {reservation}` as the plain state
  of the existing reservation with `bigint` amounts and a `Date`). `ProgramNotFoundError` and
  `CurrencyMismatchError` already exist and are reused.
- `identifier-limits.ts` gains `INVOICE_ID_MAX_LENGTH = 128`, the width the ledger's
  `reservation_id` column already has for the surrogate and the width `invoice_id` gets.
- Ports: `ReservationRepository` (`findByInvoice(programId, invoiceId)`, `add(reservation)`)
  joins `CapacityRepositories`; `Clock` (`now(): Date`, token `CLOCK`) in `ports/clock.ts`.
  A planned third method, `findActiveByProgram(programId)`, was dropped in the round 2 fix: the
  ledger helper needs closed rows too, so it reads them itself and nothing in production called
  the port method.

Application (`application/`):
- `ReserveCapacity` use case, command `{programId, invoiceId, invoiceAmount: bigint,
  invoiceCurrency, clientId}`. One `unitOfWork.run`, in this order and nothing else:
  `programs.lockById` (null: `ProgramNotFoundError`); `invoiceCurrency` differs from the
  program's: `CurrencyMismatchError` (decision 2); `reservations.findByInvoice` finds one:
  `ReservationAlreadyExistsError(existing)`; `Reservation.open` with `createdAt = clock.now()`;
  `program.reserve` (throws `CapacityExceededError`, nothing written yet); `reservations.add`,
  `ledger.append`, `programs.save`. Returns the reservation. The duplicate check runs before the
  capacity check so a repeated invoice on a full program answers `409`, not `422` (AC-05).
- `GetAvailability` is unchanged; `reserved` and `overcommitted` become real because
  `programs.reserved` moves.
- `application/testing/in-memory-capacity.fake.ts` gains `InMemoryReservations` and a
  `FixedClock`; the snapshot and restore of `InMemoryUnitOfWork` cover reservations too.

Infrastructure (`infrastructure/`):
- Migration `reservations(id UUID PK, program_id VARCHAR(64) FK programs, invoice_id
  VARCHAR(128), invoice_amount BIGINT, invoice_currency CHAR(3), currency CHAR(3),
  reserved_amount BIGINT, held BIGINT, source reservation_source ENUM ('client',
  'reconciliation'), client_id VARCHAR(128) NULL, created_at TIMESTAMPTZ, updated_at
  TIMESTAMPTZ, UNIQUE (program_id, invoice_id))`. `currency` (the program currency
  `reserved_amount` and `held` are in) was added while implementing and is not a join away from
  the program: a closed reservation keeps the currency it was taken in after a re-denomination
  (A-12), so reading it from the program would rehydrate the row in the wrong currency. The
  migration also adds `CHECK (held >= 0 AND held <= reserved_amount)` as the storage backstop
  INV-02 will lean on in S-05, and `capacity_movements.reservation_id` becomes a foreign key to
  `reservations.id` (the column exists since S-02; only the constraint is added). Generated the
  way S-02 generated its migration, with the CHECK appended by hand.
- `PrismaReservationRepository` bound to the transaction scope like the others;
  `PrismaUnitOfWork` hands it out as `reservations`. Mappers in `mappers.ts`.
- `SystemClock` (`infrastructure/system-clock.ts`), bound to `CLOCK` in `CapacityModule`.
- `IsCurrencyCode()` (`infrastructure/currency-code.ts`), added by the round 2 fix: the one
  casing rule of A-10 (uppercase, then ISO 4217) as a decorator both DTOs wear, the HTTP
  `ReserveRequestDto` and the Kafka `CapacityUpdateMessageDto`, so the two edges cannot drift
  apart again.
- `POST /programs/:programId/reservations`, body `{invoiceId, invoiceAmount, invoiceCurrency}`
  (`ReserveRequestDto`: `invoiceId` string of 1 to 128 characters, `invoiceAmount` a JSON
  integer from 1 to `Number.MAX_SAFE_INTEGER` per ADR-0006, `invoiceCurrency` ISO 4217 through
  `@IsCurrencyCode()`; any other field, `rate` included, is refused by `forbidNonWhitelisted`
  until S-04 adds it).
  `201` with `ReservationDto` `{programId, invoiceId, invoiceAmount, invoiceCurrency,
  reservedAmount, held, status, source, createdAt}`; the three amounts are declared
  `type: 'integer'` so the S-02 documentation test that checks every money field keeps
  passing. Errors, all through the global filter: `400 VALIDATION_FAILED` with `details[]`
  whose messages start with the field name, `404 PROGRAM_NOT_FOUND`, `409
  RESERVATION_ALREADY_EXISTS` with `reservation` in the body in exactly the `201` shape,
  `422 CAPACITY_EXCEEDED` with `available` in the body as an integer in program currency minor
  units, `422 CURRENCY_MISMATCH` for another currency (interim, decision 2).
- `clientId` reaches the controller through a `@ClientId()` parameter decorator in
  `src/common/auth/`, reading `AuthenticatedRequest.clientId` that the guard sets. S-05
  reuses it for releases (AC-34).
- `toErrorBody` (`src/common/filters/error-body.ts`) renders `bigint` values in a domain
  error's `details` as JSON integers and `Date` values as ISO 8601 strings, recursively
  (decision 4). `jsonInteger` moves from `modules/capacity/infrastructure/` to
  `src/common/json-integer.ts` because the filter needs it; its two callers follow.
- The public identity of a reservation on the API is the `invoiceId`, scoped by the program in
  the path (A-07); the surrogate never appears in a body or a route.
- The INV-10 route sweep needs no change: it discovers the new route and expects `401` without
  a token, which the guard answers before validation runs.

Test support (`api/test/support/`):
- `ledger-invariants.ts`: `expectLedgerInvariants(app)` reads every program in the test
  database with its movements and reservations through the Prisma adapters, runs
  `Ledger.recompute`, and asserts: the chain is not broken, the recomputed `reserved` equals
  `programs.reserved` and equals the sum of `held` of active reservations (INV-03), and the
  recomputed `held` per reservation equals the stored one (INV-04). Wired into `afterEach` of
  every e2e suite that creates or changes a program: `programs.e2e-test.ts` from S-02 and the
  two new suites. Suites that never touch a program (health, docs, cors, authentication, the
  route sweep) are left alone; the helper has nothing to check there.
- `programs.ts`: `announceProgram(app, {currency, limit})` publishes a capacity update through
  the dev producer and polls availability until the program answers `200`, returning its id;
  `awaitAvailability(app, programId, token, predicate)` polls until the predicate holds. Both
  extracted from what `programs.e2e-test.ts` does inline today, which then uses them.
- Two instances for INV-01: the suite calls `createTestApp()` twice in one Jest process. Both
  share `DATABASE_URL` and `KAFKA_BROKERS` from the global setup, neither calls `listen`, and
  supertest binds each to its own ephemeral port. The 25 requests alternate between the two
  servers inside one `Promise.all`. Prisma waits at most `maxWait` (2 s by default) for a pool
  connection when an interactive transaction starts; if the parallel run trips that limit, the
  fix is a higher `maxWait` in `PrismaUnitOfWork`, never a smaller N.

## Decisions fixed by this revision

Local choices with alternatives that were considered, none large enough for an ADR. Recorded
so review can hold the code to them.

1. **No `rate` in S-03.** Alternative: a `rate` column and field fixed at `1`. Declined because
   a placeholder for a concept with no behaviour is dead code, `Conversion rate` is S-04
   vocabulary (glossary), and no S-03 acceptance criterion names `rate`. S-04 adds the
   `NUMERIC(20,8)` column with a default of `1` backfilled for the reservations that exist by
   then (ADR-0006), the `Rate` value object and the response field in one slice.
2. **Another currency is `422 CURRENCY_MISMATCH` from the use case.** The DTO cannot know the
   program's currency, so `400` from validation is impossible without a lookup in the DTO.
   `CurrencyMismatchError` already exists with kind `unprocessable`. S-04 replaces this rule
   with AC-07 (`400` naming `rate`), which will need either a domain error kind that maps to
   `400` or a validation result from the use case; S-04 decides, this slice does not prepare
   for it.
3. **A surrogate id on `reservations`.** Alternative: the natural key `(program_id, invoice_id)`
   alone, with a composite foreign key from the ledger. Declined because Prisma refuses a
   relation whose scalar fields mix a required (`program_id`) and an optional
   (`reservation_id`) column, so the composite key would have to live outside the schema and
   would read as drift. The surrogate is a UUID the domain generates in `Reservation.open`
   (`node:crypto`, no port), stored in `id`, referenced by `capacity_movements.reservation_id`,
   and never shown on the API.
4. **The filter renders `bigint` and `Date` inside error details.** Alternative: domain errors
   carrying `number` and strings. Declined because INV-08 keeps `number` out of the domain and
   the filter is the one place a domain error becomes HTTP (CLAUDE.md §2). AC-05 asserts the
   `reservation` in the `409` body equals the `201` body of the setup, which pins the two shapes
   to each other.
5. **A `Clock` port.** Alternative: `new Date()` in the use case. Declined because the use
   case tests would then not be able to assert `createdAt`, and S-06 (INV-06) has to compare a
   reservation's `createdAt` with a snapshot's `asOf` under controlled time. Ten lines now, one
   fake, no retrofit later.
6. **Capacity shortage is thrown, not returned.** `Program.setLimit` returns `stale` as an
   outcome because staleness is not an error for the treasury. `CapacityExceeded` is an error
   the client must see as `422`, so it is a `DomainError` like `ProgramNotFoundError` and the
   filter maps it. Nothing is written before the throw, so the rollback has nothing to undo.
7. **INV-11 with a hand-rolled seeded generator.** Alternative: `fast-check`. Declined to
   keep the dependency list as ADR-0001 pinned it for a five-line `mulberry32`. It lives in
   `domain/testing/seeded-random.ts` next to the pattern S-02 set with
   `application/testing/`, and S-05 reuses it for INV-02. The seed is printed on failure so a
   sequence can be replayed.
8. **The ledger helper checks every program in the database**, not only the ones the test
   registered. The e2e suites run in band against one database, so this is both simpler and
   stronger than tracking ids per test.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-01] should reserve within capacity and show the amounts, active status and reduced availability')` | e2e | 1 200 000.00 USD (120 000 000 minor units) on a 10 000 000.00 program: `201` body has `invoiceAmount`, `reservedAmount` and `held` 120 000 000, `invoiceCurrency` USD, `status` `active`, `source` `client`, `createdAt` ISO 8601; availability then reads `reserved` 120 000 000, `available` 880 000 000 |
| `it('[AC-02] should reserve exactly the remaining capacity and leave availability at zero')` | e2e | 500 000.00 on 500 000.00 available; `201`; `available` 0, `overcommitted` false |
| `it('[AC-03] should reject a reservation that exceeds available capacity with CAPACITY_EXCEEDED and the available amount')` | e2e | 500 000.01 on 500 000.00 available: `422`, `code` `CAPACITY_EXCEEDED`, `available` 50 000 000 at the top level of the body; availability unchanged; the ledger helper finds no reservation |
| `it('[AC-04] should answer 404 PROGRAM_NOT_FOUND for a reservation on an unknown program')` | e2e | |
| `it('[AC-05] should answer 409 RESERVATION_ALREADY_EXISTS with the existing reservation for a repeated invoice')` | e2e | same amount, then a different amount: both `409`, `reservation` in the body deep equals the `201` body of the first call, availability unchanged |
| `it('[AC-08] should answer 400 naming the field for a non-positive, non-integer or non-ISO-4217 reservation')` | e2e | five requests: amount 0, amount -1, amount 12.5, currency `XYZ` (three letters, no such code), currency `XXXX`; each `400 VALIDATION_FAILED` with a `details` entry starting with `invoiceAmount` or `invoiceCurrency` respectively. The `usd` case moved out in the round 2 fix: A-10 now normalises case, so a lower case code is no longer a `400` |
| `it('should uppercase a currency code on both edges, so a lower case code reserves normally (A-10)')` | e2e | added by the round 2 fix, untagged: a program announced with `currency: usd` and a reservation sent with `invoiceCurrency: usd` both read back `USD` and the reservation is `201`, which is the pair that used to answer `CURRENCY_MISMATCH` forever |
| `it('should uppercase a currency code and still refuse one that is not ISO 4217 (A-10)')` | unit | added by the round 2 fix, untagged: `parseCapacityUpdate` maps `usd` to `USD` and refuses `XYZ`, `US` and `EURO` naming `currency` |
| `it('[AC-09] should reject any reservation on an overcommitted program with CAPACITY_EXCEEDED and available 0')` | e2e | reserve 4 000 000.00, capacity update lowers the limit to 3 000 000.00 (awaited through availability), reserve 0.01: `422`, `available` 0 |
| `it('[AC-21] should raise available when the treasury raises the limit above current usage')` | e2e | reserved 4 000 000.00, update to 12 000 000.00, `available` 8 000 000.00 |
| `it('[AC-22] should read available 0 and overcommitted true when the limit drops below usage while every held stays')` | e2e | two reservations of 2 000 000.00, update to 3 000 000.00: `available` 0, `overcommitted` true, `reserved` still 4 000 000.00; `held` of each reservation asserted through the ledger helper (the read endpoint arrives in S-05) |
| `it('[INV-01] should never overcommit under parallel reservations on one program')` | invariant (e2e) | 25 parallel requests of 1 000 000.00 on a 10 000 000.00 program, split across two application instances sharing one database: exactly 10 × `201` and 15 × `422`, `reserved` 10 000 000.00, `overcommitted` false, ledger helper green |
| `it('[INV-03] should keep program reserved equal to the sum of held of active reservations after every scenario')` | invariant (e2e) | a mixed scenario (three reservations, a limit cut, a limit raise, a rejected reservation, a duplicate) then the INV-03 assertion; the same assertion is what the `afterEach` helper runs in every suite |
| `it('[INV-04] should chain reserved_after from the previous row plus delta_held and recompute the stored state')` | unit + e2e helper | unit on `Ledger.recompute`: a correct chain of `limit_set` and `reserve` rows recomputes to the expected balances and per-reservation `held`; a chain with one wrong `reservedAfter` and one with a wrong `availableAfter` are reported `broken` at that row. The e2e half is the helper's recomputation against `programs` and `reservations` |
| `it('[INV-09] should reject a movement that carries neither clientId nor messageId')` | integration | a raw insert into `capacity_movements` with both columns null fails on the CHECK constraint; unit assertions in the use case tests show `ReserveCapacity` attributes to `clientId` and `ApplyCapacityUpdate` to `messageId` |
| `it('[INV-11] should keep available between 0 and limit over random sequences of reservations and limit changes')` | unit | 1 000 seeded sequences of up to 50 steps over `Program`: `setLimit` to random amounts including zero, `reserve` of random amounts where a `CapacityExceededError` is caught and counted; after every step `0 ≤ available ≤ limit` and `available = max(0, limit - reserved)` |

Supporting tests expected beyond the plan (untagged, listed in `wiki/plan/plan.md` by `/ship`):
`Reservation` opens active and rehydrates; `ReserveCapacity` against the fakes for not found,
currency mismatch, duplicate before capacity, capacity exceeded leaving the fakes untouched,
attribution and `createdAt` from the clock; `Ledger.recompute` on an empty chain and on a
re-denomination; the Prisma reservation adapter round trip, the unique pair and the foreign key
from the ledger; the `@ClientId()` decorator; `toErrorBody` rendering `bigint` and `Date`; the
four carried fixes.

## ADR candidates

- [[../decisions/ADR-0008-concurrency-control-per-program]]: accepted 2026-09-21 (Option 1).
  Nothing new: every decision this revision adds is local (see above).

## Definition of done

Beyond `CLAUDE.md §9`:

- The four carried S-02 minors are fixed in the first commit of the slice, test first.
- INV-01 runs in the gate with two application instances, not only one.
- The `afterEach` ledger helper is wired into every e2e suite that creates or changes a program.
- README shows a reserve request with curl and the four error codes a client can meet
  (`VALIDATION_FAILED`, `PROGRAM_NOT_FOUND`, `RESERVATION_ALREADY_EXISTS`, `CAPACITY_EXCEEDED`).
- Glossary: `source` (`client`, `reconciliation`) is a new domain word this slice puts in code
  and the API. It needs a glossary entry from `/spec` before `/review`, or review will find it.

## Hand-off notes for later slices

- S-04: adds `reservations.rate NUMERIC(20,8) NOT NULL DEFAULT 1` (backfill for S-03 rows),
  the `Rate` value object, `rate` in request and response, and replaces the interim
  `422 CURRENCY_MISMATCH` on reserve with AC-07's `400` naming `rate`.
- S-05: the release route and the reservation read use `:invoiceId`; the `@ClientId()`
  decorator and `ReservationRepository` are in place. The read model adds its own query: the
  ledger helper reads the rows directly (it needs closed ones too), so the port carries no
  listing method to extend.
- S-06: `Clock` gives INV-06 controlled time; `source: 'reconciliation'` with `clientId` null
  is already a legal state of the entity and the table.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-22 | plan (revision) | reconciled with shipped S-02 code and accepted ADR-0008; carried S-02 minors listed; eight local decisions fixed; test names unchanged, 9/9 AC and 5/5 INV named |
| 2026-09-22 | implement | slice started, branch `slice/S-03-reservations-and-capacity-invariant`, from `main` at ccad5c3 |
| 2026-09-22 | implement | built test first: 14/14 planned tests present and green (9 AC, 5 INV), INV-01 across two application instances, `npm run gate:quick` green, e2e 36/36, integration 24/24 |
| 2026-09-22 | verify | PASS, gate green on c94f8d5, 14/14 AC and INV covered at the planned level, 2 minor findings for `/ship` (ledger helper not in afterEach of capacity-invariant.e2e-test.ts, README reserve example missing) |
| 2026-09-22 | review | REVIEW S-03: 7 findings (1/0/6); blocker: glossary entry for `source` missing (`/spec`); 6 minors in style, dead test helpers and the invariant suite wiring; INV-01 critical section confirmed sound under ADR-0008 |
| 2026-09-22 | implement (review fixes, round 1) | 5 of 6 minors fixed test first, braces minor declined (lint requires them on a wrapped throw), glossary `source` via `/spec`, ledger helper reads in one transaction; `npm run gate:quick` green, e2e 36/36 |
| 2026-09-22 | verify | PASS (second pass), gate green on aadded9, 14/14 AC and INV covered at the planned level, all six review round 1 findings confirmed fixed, 1 minor still owed to `/ship` (README reserve example) |
| 2026-09-22 | review | REVIEW S-03: 4 findings (0/1/3), second pass; major: ISO 4217 casing differs between the reserve DTO and the treasury DTO, so a `usd` program can never be reserved on (`/spec` for A-10, `/implement` for one rule on both edges); 3 minors: dead `findActiveByProgram`, dead `withToken` parameter, `reservations.currency` missing from the slice file; INV-01 critical section confirmed sound under ADR-0008 |
| 2026-09-22 | spec | A-10 amended by Marcin's decision: currency codes are normalised to upper case at every boundary rather than refused for their case; glossary gains `Currency code`; no AC or INV changed |
| 2026-09-22 | implement (review fixes, round 2) | major closed with one `IsCurrencyCode()` decorator worn by both DTOs (red first on the Kafka unit case); AC-08's `usd` case replaced by `XYZ`, two untagged casing tests added; `findActiveByProgram` and the `withToken` parameter removed; slice file corrected (currency column, S-05 hand-off note, decorator, test rows); `npm run gate:quick` green, reservations e2e 11/11 |
