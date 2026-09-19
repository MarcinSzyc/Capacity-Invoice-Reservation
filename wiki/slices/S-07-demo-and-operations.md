# S-07 Demo page and operations

- Outcome: a reviewer opens `/demo` in the dev profile and watches reservations, releases and treasury messages flow through the real endpoints and the real topic; state survives a restart.
- Status: planned
- AC: AC-38, AC-39
- INV: none
- Risk: low. No business rule; a static page and a durability check. A-17 budgets half a day.
- Depends on: S-06 (the treasury panel needs snapshots).

## Scope

- Module `src/modules/demo/`, registered only when `NODE_ENV === 'development'`. Contains no business logic: it serves one HTML file with vanilla JavaScript (no build step) and two thin dev endpoints.
- `GET /demo` (`@Public()`): the page with four panels: request generator (random reserve and release calls with a dev token minted by the page through `GET /demo/token`), request log (method, path, status, code), live ledger (polls `GET /demo/programs/:programId/movements`, a dev-only read of the ledger through the `LedgerRepository` port), treasury panel (buttons for limit change, snapshot, duplicate message, stale message that call `POST /demo/treasury` which publishes to the real topic with the producer code from `npm run dev:treasury`).
- In `production` the module is not registered; `GET /demo` is `404`. The dev endpoints under `/demo/*` are public only in development, which INV-10's sweep already accounts for through `@Public()`.
- Restart durability: nothing to build beyond what S-02 to S-06 persist; the test proves it.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-38] should serve the demo page in the dev profile with generator, request log, ledger and treasury panel, and not in production')` | e2e | app booted with `development`: `200`, HTML contains the four panel ids and the real endpoint paths; a treasury panel call produces a message on the real topic (consumed in the test); app booted with `production`: `404` |
| `it('[AC-39] should read the same availability and reservations after a restart')` | e2e | reserve and partially release, capture availability and the reservation, close the Nest app, boot a new one on the same database, read both again, deep-equal |

Hand check recorded in the PR: open `/demo`, run the generator for a minute, publish each treasury action, watch the ledger.

## ADR candidates

None.

## Definition of done

Beyond `CLAUDE.md §9`:

- README has a "See it working" section: compose up, open `/demo`.
- `wiki/Home.md` status table marks every slice done and the plan complete.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
