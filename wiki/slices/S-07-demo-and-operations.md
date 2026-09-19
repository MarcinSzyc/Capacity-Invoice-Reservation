# S-07 Demo page and operations

- Outcome: a reviewer opens the `web` container's page in the dev profile and watches reservations, releases and treasury messages flow through the real `api` endpoints and the real topic; state survives a restart.
- Status: planned
- AC: AC-38, AC-39
- INV: none
- Risk: low. No business rule; a small React UI and a durability check. A-17 budgets half a day; the React scaffold from S-01 keeps it there.
- Depends on: S-06 (the treasury panel needs snapshots).

## Scope

- The UI lives in `web/` (ADR-0001): a React app (Vite, TypeScript strict) with a handful of components and plain CSS, built to static files and served by the `web` nginx container; it replaces the placeholder screen S-01 created. Four panels, each a table or a small form: request generator (random reserve and release calls against `api` with a dev token minted through `GET /dev/token`), request log (method, path, status, code), live ledger (polls `GET /dev/programs/:programId/movements`, a dev-only read of the ledger through the `LedgerRepository` port), treasury panel (buttons for limit change, snapshot, duplicate message, stale message that call `POST /dev/treasury`, which publishes to the real topic with the producer code from `npm run dev:treasury`).
- On the `api` side: module `src/modules/dev/`, registered only when `NODE_ENV === 'development'`, containing the three dev endpoints above and nothing else; no HTML, no business logic. In `production` the module is not registered and `/dev/*` is `404`. The dev endpoints are public only in development, which INV-10's sweep accounts for through `@Public()`. `api` allows CORS from the `web` origin in development (set up in S-01).
- Restart durability: nothing to build beyond what S-02 to S-06 persist; the test proves it.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-38] should serve the demo page from web with generator, request log, ledger and treasury panel, backed by dev endpoints that exist only in development')` | cold start + e2e | cold start: the `web` container answers `200` and the HTML contains the four panel ids and the `api` dev endpoint paths; e2e: `api` booted with `development` answers the three `/dev/*` endpoints and a treasury call produces a message on the real topic (consumed in the test); `api` booted with `production`: `/dev/*` is `404` |
| `it('[AC-39] should read the same availability and reservations after a restart')` | e2e | reserve and partially release, capture availability and the reservation, close the Nest app, boot a new one on the same database, read both again, deep-equal |

Hand check recorded in the PR: open the `web` port, run the generator for a minute, publish each treasury action, watch the ledger.

## ADR candidates

None.

## Definition of done

Beyond `CLAUDE.md §9`:

- README has a "See it working" section: compose up, open the `web` port.
- `wiki/Home.md` status table marks every slice done and the plan complete.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-19 | plan (revision) | compose shape per ADR-0001: api, web, db, kafka; demo in the web container |
