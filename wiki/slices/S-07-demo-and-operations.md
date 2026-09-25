# S-07 Demo page and operations

- Outcome: a reviewer opens the `web` container's page in the dev profile and watches reservations, releases and treasury messages flow through the real `api` endpoints and the real topic; state survives a restart.
- Status: in progress
- AC: AC-38, AC-39
- INV: none
- Risk: low. No business rule; a small React UI, three dev-only endpoints and a durability check. A-17 budgets half a day. The fixes carried from S-06 are local and each has a test. Runs on Opus per `CLAUDE.md §8`.
- Depends on: S-06 (the treasury panel publishes snapshots).

## What the shipped code already gives this slice

Checked against `main` at 844a7b0, after S-06, rather than assumed:

- `web/` is the S-01 placeholder: `app.tsx` lists links to health and the documentation views, `api.ts` exports `apiBaseUrl()` read from `VITE_API_BASE_URL`, two Vitest render tests. The nginx container serves the built bundle; compose builds it with the `api` port baked in.
- `configureApp` already enables CORS for `WEB_ORIGIN` outside production. Anything the page calls is covered.
- `@Public()` exists and its comment already names the S-07 dev endpoints. INV-10's sweep (`api/test/business-routes-guarded.e2e-test.ts`) exempts exactly the controller routes marked `@Public()`, so the dev routes are swept for free.
- `mintToken` (`common/auth/mint-token.ts`) signs the way the guard verifies. Its comment says nothing at runtime mints; the dev token endpoint changes that, only outside production.
- `DevTreasuryProducer` (`capacity/infrastructure/messaging/`) publishes both message types through the `MessageSource` port; its comment already names the S-07 treasury panel. It is not a Nest provider today: the seed command and the tests construct it.
- `LedgerRepository` has no program-wide read: `findByReservation`, `findLastByReservations`, `findClientMovementsSince`. The live ledger needs a new read.
- `AppModule` is static, and `main.ts` creates it before any config is read. Test apps override `APP_CONFIG` after the module graph is fixed, so a module chosen from the profile has to be chosen before the graph is built (local decision 1).
- The served page is `index.html` with an empty `#root`; the panels exist only after the bundle runs. A cold start check on the HTML for panel ids, as the first version of this file proposed, could never pass. The panels are proved by a render test instead (local decision 5).

## Scope

`api`, dev only:

- `CapacityDevModule` in `src/modules/capacity/capacity-dev.module.ts`, with one controller, `infrastructure/http/dev.controller.ts`, every route `@Public()` and under the Swagger tag `dev`:
  - `GET /dev/token`: `{token}` minted with the running api's JWT config, subject `demo-web`, 8 h. The page asks for it once on load.
  - `GET /dev/programs/:programId/movements`: the latest 100 movements of the program, newest first, as `CapacityMovementDto` plus `reservedAfter` and `availableAfter` in minor units, and the program's `currency`. `PROGRAM_NOT_FOUND` for an unannounced program, like every read.
  - `POST /dev/treasury`: body `{type: 'capacity_update' | 'reconciliation_snapshot', programId, currency, creditLimit, messageId?, eventTime?, asOf?, activeReservations?: [{invoiceId, heldAmount}]}`, amounts JSON integers in minor units. Publishes with `DevTreasuryProducer` on the real topic and answers `202` with the published message, `messageId` and time filled in when absent. It does not validate business rules: whatever it publishes is judged by the real consumer, which is the point of the panel.
- A query `ListProgramMovements` in `application/`, reading through a new `LedgerRepository.findLatestByProgram(programId, limit)` inside `readSnapshot` with the program; the Prisma adapter, its integration test and the in-memory fake get it. Exported by `CapacityModule` together with `DevTreasuryProducer`, which becomes a provider.
- `AppModule.forProfile(profile)`: imports `CapacityDevModule` unless the profile is `production`. `main.ts` reads the profile once before creating the app; the e2e harness passes the profile of the config it builds.

`web`:

- `app.tsx` replaces the placeholder with four panels, each a section with a stable id (`generator`, `request-log`, `ledger`, `treasury`) and a heading, plus a program id field (default `PRG-1`). The documentation links stay in the header.
- `api.ts` grows a small client: fetches the dev token, sends every call with it, and reports each call (method, path, status, the error body's `code`) to the request log. It computes nothing about capacity, money or status.
- Request generator: start and stop. While running, once a second it either reserves a new invoice (random id, random amount between 1 and 100 000 minor units, in the program's currency as availability reports it) or releases one it reserved earlier, in full or in part, with a fresh `releaseId`. Random inputs are not computation: every outcome shown comes from the response.
- Request log: the last 50 calls, newest first.
- Live ledger: availability (`limit`, `reserved`, `available`, `asOf`) and the movement list, polled once a second.
- Treasury panel: a limit field and four buttons. "Limit change" publishes a capacity update with the typed limit. "Snapshot" publishes a snapshot with the typed limit and a reservations field in the `dev:treasury` form, `INV-A:70000000,INV-B:0`, split into entries in the page. "Duplicate" publishes the last message again with its `messageId`. "Stale" publishes a capacity update with `eventTime` `2000-01-01T00:00:00Z`, older than anything the seed or the panel sends.
- Plain CSS in `index.css`; no state library, no router.

Carried from S-06 (review round 3), first commits of the slice:

- The major: `TreasuryCapacityConsumer` calls `parseCapacityUpdate` and `parseReconciliationSnapshot` outside any handler, so a message that makes `plainToInstance` overflow the stack (an unknown field nested about 5 000 arrays deep) leaves `handle` rejected and is redelivered forever. A throw while parsing becomes a rejection like any malformed message: dead-lettered with the error, recorded, consumption continues (A-13 clause 4).
- `sumOfDeltas` in `apply-reconciliation-snapshot.use-case.ts` groups the movements after `asOf` by reservation once instead of filtering them once per reservation. Behaviour unchanged; the existing tests cover it.
- `domain/ports/ledger.repository.ts`: each doc comment back above its own method.
- `prisma-ledger.repository.ts`: the comment on `findLastByReservations` says what the query does (Prisma without `nativeDistinct` reads every row of the listed reservations and keeps the last per reservation in memory), instead of claiming `DISTINCT ON`.
- Stays a known limitation, as shipped: a program with more active reservations than the 10 000 list bound is outside the bound tests.

## Local decisions

1. **The dev module is chosen when the module graph is built, not hidden behind a guard.** AC-38 says the production profile serves none of the dev endpoints. A guard answering `404` in production would leave the routes registered, visible to INV-10's sweep and to anyone reading the route table; `AppModule.forProfile` leaves them out. `development` and `test` both get them (A-17: "outside the production profile"), so the e2e suite exercises them.
2. **The dev module lives inside the capacity area.** Two of its three routes are about programs and treasury messages, and a business word outside `src/modules/<area>/` is a review finding (`CLAUDE.md §2`). The token route sits with them rather than in `common/`, because it exists only for the demo and `common/` is always loaded.
3. **The treasury panel does not pre-judge.** `POST /dev/treasury` checks types (so a `bigint` can be built) and nothing else. A limit below `reserved`, a currency change on a program with reservations, a snapshot omitting everything: the consumer's answer is what the reviewer came to see.
4. **Only the page runs the generator.** No server-side loop, no timer in `api`: a closed tab stops the traffic.
5. **The four panels are proved by a render test, the endpoints by an e2e test.** A static bundle cannot be asserted from its HTML; `web` has no e2e level (`CLAUDE.md §5`). The cold start keeps its existing check that the page answers `200`.

## Tests by name

| Test | Level | File | Notes |
|---|---|---|---|
| `it('[AC-38] should answer the dev endpoints the demo page relies on through the real api and topic in development and none of them in production')` | e2e | `api/test/demo.e2e-test.ts` | Dev profile: `GET /dev/token` returns a token the availability route accepts; `POST /dev/treasury` with a capacity update for a new program produces a message on the real topic, consumed by the real consumer, after which availability reports the limit; `GET /dev/programs/:programId/movements` lists its `limit_set`. Production profile: all three are `404`. |
| `it('[AC-38] should show the request generator, the request log, the live ledger and the treasury panel')` | render | `web/src/app.test.tsx` | Renders `App` with `fetch` stubbed, finds the four section ids and headings, the generator's start button and the treasury panel's four buttons. |
| `it('[AC-38] should log each call with its method, path, status and error code')` | render | `web/src/app.test.tsx` | A stubbed `422` with `CAPACITY_EXCEEDED` appears in the request log as sent. Proves the page shows what `api` answered. |
| `it('[AC-39] should read the same availability and reservations after a restart')` | e2e | `api/test/restart.e2e-test.ts` | Reserve and partially release, capture availability and the reservation read, close the Nest app, boot a new one on the same database and broker, read both again, deep-equal. |
| `it('should dead-letter a treasury message whose parsing throws and keep consuming')` | unit | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.test.ts` | Carried major. Supporting, untagged: AC-24 closed in S-02. Both types: a capacity update and a snapshot each carrying an unknown field nested 5 000 arrays deep; `handle` resolves, one dead letter and one rejection record each, and the next message is applied. |
| `it('should list the latest movements of a program newest first, at most the limit asked for')` | integration | `api/src/modules/capacity/infrastructure/persistence/prisma-capacity.integration-test.ts` | Supporting, untagged: the new port read. |

Hand check recorded in the PR: open the `web` port, run the generator for a minute, publish each treasury action, watch the ledger and the request log.

## ADR candidates

None. Local decisions 1 and 2 have alternatives, but both follow from rules already accepted (ADR-0001, A-17, `CLAUDE.md §2`), so they stay here.

## Definition of done

Beyond `CLAUDE.md §9`:

- README has a "See it working" section: compose up, open the `web` port, what each panel does.
- `wiki/Home.md` status table marks every slice done and the plan complete.
- The changelog row for S-07 names the carried S-06 findings as closed, and the one that stays open.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-19 | plan (revision) | compose shape per ADR-0001: api, web, db, kafka; demo in the web container |
| 2026-09-25 | plan (revision) | reconciled with the shipped S-06 code: dev module chosen by profile, the ledger read, the treasury endpoint body, panels proved by render tests, the S-06 carried findings |
| 2026-09-25 | implement | started on Fable; carried S-06 findings first |
