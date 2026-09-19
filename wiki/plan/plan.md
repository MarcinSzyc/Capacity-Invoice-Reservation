# Plan

The list of every requirement and where it stands. One row per acceptance criterion and
per invariant from [[../spec/acceptance-criteria]] and [[../spec/invariants]]. Written by
`/plan` (id, slice, test name, level), completed by `/ship` (test file, commit, status).
Slices themselves live in [[../slices/README]], one file each.

Status: `planned`, `in progress`, `done`, `superseded by <id>`.

| Id | Slice | Status | Test name | Level | Test file | Commit |
|---|---|---|---|---|---|---|
| AC-00 | S-01 | planned | `[AC-00] should start with docker compose up, turn ready and answer GET /health and both documentation views without a token` | cold start | | |
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
| AC-20 | S-02 | planned | `[AC-20] should create the program from the first capacity update and expose its availability` | e2e | | |
| AC-21 | S-03 | planned | `[AC-21] should raise available when the treasury raises the limit above current usage` | e2e | | |
| AC-22 | S-03 | planned | `[AC-22] should read available 0 and overcommitted true when the limit drops below usage while every held stays` | e2e | | |
| AC-23 | S-02 | planned | `[AC-23] should record a repeated messageId as duplicate and change nothing` | contract | | |
| AC-24 | S-02 | planned | `[AC-24] should keep the newer limit and record an older eventTime update as stale` | contract | | |
| AC-25 | S-02 | planned | `[AC-25] should dead-letter a malformed message, log it and apply the next valid one` | contract | | |
| AC-26 | S-06 | planned | `[AC-26] should add an unknown reservation from the snapshot with source reconciliation and an adjustment movement` | e2e | | |
| AC-27 | S-06 | planned | `[AC-27] should release by adjustment a reservation created before asOf that the snapshot omits` | e2e | | |
| AC-28 | S-06 | planned | `[AC-28] should keep a reservation created after asOf that the snapshot omits` | e2e | | |
| AC-29 | S-06 | planned | `[AC-29] should correct held to the snapshot value with an adjustment for the difference` | e2e | | |
| AC-30 | S-06 | planned | `[AC-30] should ignore a snapshot older than the last applied one and record it as stale` | contract | | |
| AC-31 | S-06 | planned | `[AC-31] should set limit and currency from the snapshot and expose its asOf in availability` | e2e | | |
| AC-32 | S-02 | planned | `[AC-32] should answer 401 to a business request without a bearer token` | e2e | | |
| AC-33 | S-02 | planned | `[AC-33] should answer 401 to an expired or wrongly signed token` | e2e | | |
| AC-34 | S-05 | planned | `[AC-34] should record the authenticated client id on reserve and release movements` | e2e | | |
| AC-35 | S-02 | planned | `[AC-35] should serve liveness, readiness and the API documentation without a token and without business data` | e2e | | |
| AC-36 | S-02 | planned | `[AC-36] should start from a clean checkout and answer an authenticated availability request for the sample program` | cold start | | |
| AC-37 | S-02 | planned | `[AC-37] should mint a dev token that the availability request accepts` | cold start | | |
| AC-38 | S-07 | planned | `[AC-38] should serve the demo page in the dev profile with generator, request log, ledger and treasury panel, and not in production` | e2e | | |
| AC-39 | S-07 | planned | `[AC-39] should read the same availability and reservations after a restart` | e2e | | |
| AC-40 | S-02 | planned | `[AC-40] should write JSON log lines sharing one correlation id per request and per message` | e2e | | |
| AC-41 | S-01 | planned | `[AC-41] should link the README to the assumptions register, the decision records and the run instructions` | unit | | |
| INV-01 | S-03 | planned | `[INV-01] should never overcommit under parallel reservations on one program` | invariant (e2e) | | |
| INV-02 | S-05 | planned | `[INV-02] should keep held between 0 and reservedAmount over random release sequences` | unit | | |
| INV-03 | S-03 | planned | `[INV-03] should keep program reserved equal to the sum of held of active reservations after every scenario` | invariant (e2e) | | |
| INV-04 | S-03 | planned | `[INV-04] should chain reserved_after from the previous row plus delta_held and recompute the stored state` | unit + e2e helper | | |
| INV-05 | S-06 | planned | `[INV-05] should leave every balance and ledger row unchanged when every message and request of a scenario is replayed` | invariant (e2e) | | |
| INV-06 | S-06 | planned | `[INV-06] should never alter a reservation by a snapshot whose asOf precedes its creation` | invariant (e2e) | | |
| INV-07 | S-06 | planned | `[INV-07] should reach the same final state for shuffled and reversed message order as for in-order delivery` | invariant (contract) | | |
| INV-08 | S-04 | planned | `[INV-08] should keep money as integer minor units with a currency, refuse cross-currency arithmetic and round conversions half up` | unit | | |
| INV-09 | S-03 | planned | `[INV-09] should reject a movement that carries neither clientId nor messageId` | integration | | |
| INV-10 | S-02 | planned | `[INV-10] should answer 401 on every business route without a token` | invariant (e2e) | | |
| INV-11 | S-03 | planned | `[INV-11] should keep available between 0 and limit over random sequences of reservations and limit changes` | unit | | |
