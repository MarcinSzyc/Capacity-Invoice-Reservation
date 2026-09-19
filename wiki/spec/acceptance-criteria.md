# Acceptance criteria

Observable behaviour of the service, one behaviour per criterion, Given / When / Then.
Each references the assumptions in [[assumptions]] it depends on. Ids are stable.
Every AC gets at least one tagged test; the mapping lives in [[../plan/traceability]].
Status codes and error codes are part of the contract; storage, endpoint paths and
libraries are not mentioned here.

Money in examples: program `PRG-1` in USD, limit 10 000 000.00, written in major units for
readability; the API uses integer minor units.

## Setup

## Baseline

**AC-00 Project baseline (walking skeleton).** Given a clean checkout with Docker. When
`docker compose up` is run. Then the `api` (NestJS on Node 24 LTS), the `web` UI (React, static build), `db` and
`kafka` containers start, readiness turns healthy, `GET /health` answers `200` without a
token, and the `web` page answers `200`.
And `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`,
`npm run gate:quick` and `npm run gate` exist and pass on the fresh project, with ESLint
and Prettier configured as `CLAUDE.md §3` requires. And API documentation is served in
the non-production profile in two views over the same OpenAPI document: Swagger UI for
trying requests and Redoc for reading. And the README explains how to start the service,
where the health endpoint is and where both documentation views are. [A-16, A-17]

## Reservations

**AC-01 Reserve within capacity.** Given `PRG-1` has 10 000 000 available. When a client
reserves invoice `INV-A` for 1 200 000 USD. Then the response is `201` with the
reservation showing `invoiceAmount` 1 200 000 USD, `reservedAmount` 1 200 000 USD,
`held` 1 200 000 USD, status active, and availability of `PRG-1` reads 8 800 000.
[A-05, A-06, A-10]

**AC-02 Reserve exactly the remaining capacity.** Given `PRG-1` has 500 000 available.
When a client reserves 500 000 USD. Then `201` and availability reads 0, not
overcommitted. [A-06]

**AC-03 Reserve beyond capacity.** Given `PRG-1` has 500 000 available. When a client
reserves 500 000.01 USD. Then `422` with code `CAPACITY_EXCEEDED` and `available`
500 000 in the body, and no state changes. [A-06, A-07]

**AC-04 Reserve on an unknown program.** When a client reserves on a program the
treasury never announced. Then `404` with code `PROGRAM_NOT_FOUND`. [A-05]

**AC-05 Duplicate invoice.** Given `INV-A` is reserved on `PRG-1`. When a client reserves
`INV-A` on `PRG-1` again, with the same or a different amount. Then `409` with code
`RESERVATION_ALREADY_EXISTS` and the existing reservation in the body, and no state
changes. [A-07]

**AC-06 Cross-currency reservation.** Given `PRG-1` is in USD. When a client reserves
`INV-B` for 2 750 000 EUR with `rate` 1.10. Then `201`, `reservedAmount` and `held` are
3 025 000 USD, the rate 1.10 is stored on the reservation, and availability drops by
3 025 000. [A-02, A-10]

**AC-07 Rate validation.** When a client reserves in EUR on a USD program without
`rate`, or in USD on a USD program with `rate` other than 1. Then `400` with a
validation error naming the field. [A-02]

**AC-08 Amount and currency validation.** When a client reserves with a non-positive
amount, a non-integer minor-unit amount, or a currency code that is not ISO 4217. Then
`400` with a validation error naming the field. [A-10]

**AC-09 Reserve on an overcommitted program.** Given `PRG-1` is overcommitted (limit
lowered below reserved). When a client reserves any positive amount. Then `422`
`CAPACITY_EXCEEDED` with `available` 0. [A-06]

## Releases

**AC-10 Partial release.** Given `INV-B` holds 3 025 000 USD (2 750 000 EUR at 1.10).
When the client releases 1 000 000 EUR with `releaseId` `R-1`. Then `200`, `held` is
1 925 000 USD, the reservation is still active, and availability grows by 1 100 000.
[A-08]

**AC-11 Release without amount closes the reservation.** Given `INV-B` holds 1 925 000
USD. When the client releases with no amount and `releaseId` `R-2`. Then `200`, `held`
is 0, status closed, availability grows by 1 925 000. [A-08]

**AC-12 Final instalment closes exactly.** Given a reservation whose remaining `held`
does not divide evenly by the rate. When the client releases the exact remaining invoice
amount. Then `held` is 0, not one minor unit above or below. [A-08, A-10]

**AC-13 Release beyond held.** Given `INV-A` holds 500 000 USD. When the client releases
500 000.01 USD. Then `422` with code `RELEASE_EXCEEDS_HELD` and no state change. [A-08]

**AC-14 Release on an unknown reservation.** When the client releases against an invoice
id that has no reservation on that program. Then `404` `RESERVATION_NOT_FOUND`. [A-09]

**AC-15 Release on a closed reservation.** Given `INV-A` has `held` 0. When the client
releases with a new `releaseId`. Then `409` `RESERVATION_ALREADY_RELEASED`. [A-09]

**AC-16 Repeated release id.** Given `releaseId` `R-1` was applied to `INV-B`. When the
client sends `R-1` again, with any amount. Then `409` `RELEASE_ALREADY_PROCESSED` with
the original outcome (applied at, `held` after) in the body and no state change. [A-09]

**AC-17 Release reason.** When the client releases with `reason` `cancelled`. Then the
effect on `held` and availability is the same as for `repaid`, and the reservation's
movements show the reason `cancelled`. Omitting `reason` records `repaid`. [A-08]

## Reading state

**AC-18 Availability is immediate.** Given a client received `201` for a reservation or
`200` for a release. When any client reads the program's availability right after. Then
limit, reserved, available, currency, `asOf` of the last reconciliation and an
`overcommitted` flag are returned and already reflect that operation. [A-06, A-19]

**AC-19 Reservation by id.** When a client reads a reservation. Then the response shows
`invoiceAmount`, `invoiceCurrency`, `reservedAmount`, `held`, `rate`, status, source and
the list of its movements with kind, amount, reason, `releaseId` or `messageId`, and
time. [A-19]

## Treasury capacity updates

**AC-20 First message creates the program.** Given no program `PRG-2` exists. When a
capacity update for `PRG-2` with limit 5 000 000 EUR arrives. Then availability of
`PRG-2` reads 5 000 000 EUR. [A-05, A-11]

**AC-21 Limit raised.** Given `PRG-1` has limit 10 000 000 and reserved 4 000 000. When a
capacity update sets the limit to 12 000 000. Then available reads 8 000 000. [A-06]

**AC-22 Limit lowered below usage.** Given reserved is 4 000 000. When a capacity update
sets the limit to 3 000 000. Then available reads 0, `overcommitted` is true, and every
existing reservation keeps its `held`. [A-06]

**AC-23 Duplicate message.** Given message `m-1` was applied. When `m-1` arrives again.
Then no state changes and the message is recorded as a duplicate. [A-13]

**AC-24 Stale update.** Given a capacity update with `eventTime` 10:05 set the limit to
9 000 000. When an update with `eventTime` 10:00 and limit 8 000 000 arrives. Then the
limit stays 9 000 000 and the message is recorded as stale. [A-13]

**AC-25 Malformed message.** When a message that fails schema validation arrives,
followed by a valid one. Then the malformed message is logged and sent to the
dead-letter topic, and the valid one is applied. [A-13]

## Reconciliation snapshots

**AC-26 Snapshot adds a reservation we did not know.** Given `PRG-1` has no reservation
for `INV-X`. When a snapshot with `asOf` 18:00 lists `INV-X` with `heldAmount` 700 000.
Then `INV-X` exists with source `reconciliation` and `held` 700 000, and a movement of
kind `adjustment` referencing the snapshot's `messageId` exists. [A-12]

**AC-27 Snapshot releases a reservation created before asOf.** Given `INV-A` was created
at 09:00 and is active. When a snapshot with `asOf` 18:00 does not list `INV-A`. Then
`INV-A` has `held` 0, status closed, and an `adjustment` movement records the release.
[A-12]

**AC-28 Snapshot keeps a reservation created after asOf.** Given `INV-C` was created at
18:00:30. When a snapshot with `asOf` 18:00 does not list `INV-C`. Then `INV-C` is
unchanged. [A-12]

**AC-29 Snapshot corrects held.** Given `INV-B` has `held` 1 925 000. When a snapshot lists
`INV-B` with `heldAmount` 1 900 000. Then `held` is 1 900 000 and an `adjustment` of
−25 000 exists. [A-12]

**AC-30 Older snapshot ignored.** Given a snapshot with `asOf` 18:00 was applied. When a
snapshot with `asOf` 12:00 arrives. Then no state changes and it is recorded as stale.
[A-12]

**AC-31 Snapshot sets limit and currency.** When a snapshot arrives with limit
7 000 000. Then the program's limit is 7 000 000 and `asOf` in availability equals the
snapshot's `asOf`. [A-12]

## Authentication

**AC-32 No token.** When any business request arrives without a bearer token. Then
`401`. [A-14]

**AC-33 Bad token.** When a request carries an expired or wrongly signed token. Then
`401`. [A-14]

**AC-34 Client identity recorded.** When an authenticated client reserves or releases.
Then the resulting movement carries that client's id. [A-14]

**AC-35 Health and docs without token.** When liveness or readiness is called without a
token. Then `200` with no business data. When the API documentation (Swagger UI or Redoc) is
requested without a token in a non-production profile. Then it is served. [A-16]

## Operations

**AC-36 Cold start.** Given a clean checkout with Docker available. When the documented
single command is run. Then the service, its database and Kafka start, readiness turns
healthy, and an authenticated availability request for the sample program succeeds.
[A-17]

**AC-37 Dev token.** When the documented token command is run. Then it prints a token
that AC-36's request accepts. [A-14, A-17]

**AC-38 Demo page.** Given the compose stack in the dev profile. When the `web` container's
page is opened. Then it shows the request generator, the request log, the live ledger and
the treasury panel, and every action it performs goes through the real `api` endpoints and
the real Kafka topic. Given the production profile, the `api` serves no page and none of the
dev-only endpoints the page relies on. [A-17, ADR-0001]

**AC-39 Restart keeps state.** Given reservations exist. When the service restarts. Then
availability and reservations read the same as before. [A-15]

**AC-40 Structured logs.** When a request or a message is processed. Then one JSON log
line per step carries a correlation id shared across that request's or message's lines.
[A-18]

**AC-41 Assumptions documented.** The repository README links to the assumptions
register, the decision records and the run instructions, and each is current at every
shipped slice. [brief: "document them briefly"]

## Changes

Every addition, amendment or supersession of an AC, newest last. Ids never change.

| Date | Id | Change | Where |
|---|---|---|---|
| 2026-09-19 | AC-01 to AC-41 | first version, output of the spec gate | PR #5 |
| 2026-09-19 | AC-00 | added: project baseline (walking skeleton), Node 24, compose, gate scripts, README, API docs | PR #10 |
| 2026-09-19 | AC-35 | amended: API documentation is Swagger UI and Redoc over one OpenAPI document | PR #10 |
| 2026-09-19 | AC-38 | amended: the demo page is the `web` container, `api` keeps only dev-only endpoints (ADR-0001) | docs/adr-renumber-and-deployment |
| 2026-09-19 | AC-00 | amended: four containers, `web` is a React UI in its own folder (ADR-0001) | docs/adr-renumber-and-deployment |
