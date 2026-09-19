# S-03 Reservations and the capacity invariant

- Outcome: a client reserves capacity for an invoice in program currency, is refused when capacity is short or the invoice is already reserved, and two parallel clients can never both take the same free capacity.
- Status: planned
- AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22
- INV: INV-01, INV-03, INV-04, INV-09, INV-11
- Risk: high. Concurrency: the core invariant of the brief (never overcommit) is decided here, under two service instances against one database. Implemented on Fable per `CLAUDE.md §8`.
- Depends on: S-02. ADR that must be accepted first: [[../decisions/ADR-0008-concurrency-control-per-program]].

## Scope

Domain:
- `Reservation` entity: `programId`, `invoiceId`, `invoiceAmount` (Money, invoice currency), `reservedAmount` (Money, program currency), `held` (Money, program currency), `rate` (fixed `1` in this slice; S-04 adds real rates), `status` derived from `held` (`active` when `held > 0`, `closed` when `0`), `source` (`client` here, `reconciliation` in S-06), `createdAt`, `clientId`.
- `Program.reserve(held)`: returns `CapacityExceeded(available)` when `held > available`, otherwise the new `reserved` and a `reserve` movement (`deltaHeld = +held`). On an overcommitted program `available` is `0`, so any positive amount fails (AC-09).
- `Ledger` domain service: `recompute(movements)` returns the state implied by the chain and checks the chain rule `reservedAfter = previous.reservedAfter + deltaHeld` and `availableAfter = max(0, limitAfter - reservedAfter)` (INV-04).
- Domain errors: `CapacityExceeded`, `ReservationAlreadyExists`, `ProgramNotFound`.

Application:
- `ReserveCapacity` use case: one transaction, lock the program row (ADR-0008), find an existing reservation for `(programId, invoiceId)` → `ReservationAlreadyExists(existing)`, `Program.reserve`, persist reservation, append movement with `clientId`, update `programs.reserved`. Returns the reservation.
- Same-currency validation lives in the DTO: `invoiceCurrency` must equal the program currency until S-04 (a different currency is `400` here; S-04 changes that rule and its test).

Infrastructure:
- Migration: `reservations(id, program_id FK, invoice_id, invoice_amount BIGINT, invoice_currency, reserved_amount BIGINT, held BIGINT, rate NUMERIC per ADR-0006, source, client_id NULL, created_at, UNIQUE (program_id, invoice_id))`. `capacity_movements.reservation_id` references it.
- `POST /programs/:programId/reservations` body `{invoiceId, invoiceAmount, invoiceCurrency, rate?}` → `201` with the reservation `{programId, invoiceId, invoiceAmount, invoiceCurrency, reservedAmount, held, rate, status, source, createdAt}`. Errors: `400 VALIDATION_FAILED` (`details.fields[]` names each field), `404 PROGRAM_NOT_FOUND`, `409 RESERVATION_ALREADY_EXISTS` (`details.reservation`), `422 CAPACITY_EXCEEDED` (`details.available`, integer minor units, program currency).
- The reservation id in every later route is the `invoiceId`, since `(programId, invoiceId)` is unique (A-07); no generated public id.
- `GET /programs/:programId/availability` now returns real `reserved` and `overcommitted`.
- Test support: `expectLedgerInvariants(programId)` helper (INV-03 and INV-04 recomputation) called in `afterEach` of every e2e suite from this slice on, including the S-02 suites.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-01] should reserve within capacity and show the amounts, active status and reduced availability')` | e2e | 1 200 000 USD on a 10 000 000 program; body fields per the AC; availability reads 8 800 000 |
| `it('[AC-02] should reserve exactly the remaining capacity and leave availability at zero')` | e2e | 500 000 on 500 000 available; `overcommitted` false |
| `it('[AC-03] should reject a reservation that exceeds available capacity with CAPACITY_EXCEEDED and the available amount')` | e2e | 500 000.01 on 500 000 available; `details.available` = 50 000 000 minor units; availability unchanged; no reservation created |
| `it('[AC-04] should answer 404 PROGRAM_NOT_FOUND for a reservation on an unknown program')` | e2e | |
| `it('[AC-05] should answer 409 RESERVATION_ALREADY_EXISTS with the existing reservation for a repeated invoice')` | e2e | same amount and different amount, both `409`, availability unchanged |
| `it('[AC-08] should answer 400 naming the field for a non-positive, non-integer or non-ISO-4217 reservation')` | e2e | three requests: amount 0 and negative, amount 12.5, currency `usd` and `XXXX`; each `details.fields` names the field |
| `it('[AC-09] should reject any reservation on an overcommitted program with CAPACITY_EXCEEDED and available 0')` | e2e | reserve 4 000 000, capacity update lowers limit to 3 000 000, reserve 1 → `422` with `details.available` 0 |
| `it('[AC-21] should raise available when the treasury raises the limit above current usage')` | e2e | reserved 4 000 000, update to 12 000 000, available 8 000 000 |
| `it('[AC-22] should read available 0 and overcommitted true when the limit drops below usage while every held stays')` | e2e | reserved 4 000 000, update to 3 000 000; each reservation's `held` unchanged (assert via the `201` bodies kept from setup and the ledger helper; the read endpoint arrives in S-05) |
| `it('[INV-01] should never overcommit under parallel reservations on one program')` | invariant (e2e) | 25 parallel requests of 1 000 000 on a 10 000 000 program: exactly 10 × `201`, 15 × `422`, reserved 10 000 000. Repeated with two Nest application instances in the same test process (different ports, one Postgres container), requests split across both. |
| `it('[INV-03] should keep program reserved equal to the sum of held of active reservations after every scenario')` | invariant (e2e) | mixed scenario of reservations and limit changes, then the assertion; the same assertion is the `afterEach` helper of every e2e suite |
| `it('[INV-04] should chain reserved_after from the previous row plus delta_held and recompute the stored state')` | unit + e2e helper | unit: `Ledger.recompute` on hand-built chains including a broken one that must be reported; e2e: the helper recomputes from the first row and compares with `programs` and `reservations` |
| `it('[INV-09] should reject a movement that carries neither clientId nor messageId')` | integration | repository insert against the Postgres container violates the CHECK; plus unit assertions that `ReserveCapacity` sets `clientId` and `ApplyCapacityUpdate` sets `messageId` |
| `it('[INV-11] should keep available between 0 and limit over random sequences of reservations and limit changes')` | unit | property test over `Program` with a seeded generator (fast-check or a hand-rolled PRNG), 1 000 sequences |

## ADR candidates

- [[../decisions/ADR-0008-concurrency-control-per-program]]: pessimistic row lock (`SELECT ... FOR UPDATE`, A-04's recommendation) vs optimistic version column vs conditional `UPDATE ... WHERE` vs serializable isolation with retry.

## Definition of done

Beyond `CLAUDE.md §9`:

- INV-01 runs in the gate with two application instances, not only one.
- The `afterEach` ledger helper is wired into every existing e2e suite.
- README shows a reserve request with curl and the three error codes.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
