# Work log

Append-only. One entry per working session or gate run. Never edit past entries;
correct with a new one. Format:

```
## YYYY-MM-DD HH:MM, <gate or topic>, <model>
- what was done
- decisions made and why (link ADRs)
- open items
```

---

## 2026-09-18, setup, Fable
- Agreed the flow: spec → plan → (implement → verify → review → ship) per slice.
- Wrote `CLAUDE.md` and six project skills under `.claude/skills/`.
- Copied the brief into `wiki/spec/brief.{pdf,md}`.
- Reviewed `championhealth-backend` conventions; carried over module structure, style
  rules, DTO validation, global exception filter, naming and test conventions.
  Deliberately not carried over: MongoDB (deferred to ADR), business logic in services
  (moved to a framework-free domain layer), non-strict tsconfig, Jira-bound PR template.
- Open: Marcin wants to add items to the code standards before `/spec`.
- Added Marcin's code style rules: no nested ternaries, `if` nesting limited to one
  level, one-line `if` without braces, no em or en dashes in any prose. Mapped to ESLint
  (`no-nested-ternary`, `max-depth: 2`, `curly: multi-line`) and a `check:prose` script in
  `gate:quick`. Removed every long dash already present in the repo.

## 2026-09-18 and 2026-09-19, spec, Fable
- Wrote glossary and 27 open questions (Q28 added during discussion). Published the
  "Akapit po akapicie" page with one answer card per question, persisted answers,
  approval state and reopen-after-approval marker.
- Long discussion with Marcin settled: domain reading (reservation = money out, repaid
  = money back), system boundary (supplier and buyer outside, client platform over HTTP,
  treasury over Kafka, Kafka is not our queue), data model (ledger with running
  balances, treasury_messages with payload), rate from the client payload, no TTL,
  partial releases with reason enum, duplicates as 409 with original outcome.
- Published two more pages: "Granice systemu" (context map, reserve flow, reconciliation
  Venn) and "Model danych" (tables, relations, example ledger, balance-only vs ledger).
- Assumptions A-01..A-19 written; A-05 is an interpretation of Marcin's note on Q01 and
  needs a wording confirmation. AC-01..AC-41 and INV-01..INV-11 written. All questions
  marked answered. Glossary extended with amounts table, technical words, release reason,
  ledger.
- CLAUDE.md: branch-per-slice strategy (slice branches, PR, --no-ff merge, tag), glossary
  rule, stable error codes rule. Ship skill and CONTRIBUTING aligned.
- Riskiest assumptions: A-12 (snapshot semantics compare two systems' clocks), A-02
  (client supplies the rate; divergence from treasury shows up only as adjustments),
  A-04 (serialisation by database lock; mechanism still an ADR).
- Next: `/plan`.
- Removed dedication wording across the repo: the source document is called "the brief",
  the original PDF is not kept in the repo (its metadata carried a title we do not want),
  the transcription in `wiki/spec/brief.md` stays.

## 2026-09-19, setup/ci-actions-node24
- PR #9: GitHub actions bumped to v7 (Node 24 runtime), gate job on Node 24 LTS, new CI job failing a PR that does not touch the work-log.
## 2026-09-19, setup/slice-files
- PR #8: plan.md is the requirement checklist (traceability folded in), slices one file each under wiki/slices with README index, /plan accepts AC and INV ids, spec revisions add Changes rows, every PR appends to the work-log.
## 2026-09-19, setup and process, Fable
- Merged the setup PRs #1 to #7 (CLAUDE.md, skills, process docs, wiki skeleton, spec,
  append-only PR branches, CI). Process rules agreed with Marcin and written into
  CLAUDE.md §6 and CONTRIBUTING: he reviews on GitHub and gives the go-ahead as a PR
  comment (Approve is disabled for the PR author), fixes after a PR is open are new
  commits, never amend or force-push. Earlier force-pushes on #1 to #5 predate the rule.
- CI: prose check (no long dashes in Markdown or commit messages) and the gate job, which
  skips itself until package.json exists. Actions bumped to v7, Node 24 LTS (PR #9).
- Plan restructured (PR #8): `wiki/plan/plan.md` is the list of every AC and INV with
  slice, status, test and commit (traceability folded in); slices are one file each under
  `wiki/slices/` with `README.md` as the ordered index; `/plan` accepts AC and INV ids to
  plan one slice at a time. A `/plan` run from another session, made before this change,
  produced a single 487-line plan.md on main; it was removed from the repo unmerged, a
  copy kept outside the repo for reference.
- Spec revision (PR #10): Marcin added AC-00, the project baseline (walking skeleton),
  rewritten into testable clauses keeping every item: compose up, health without token,
  lint/format/typecheck/test/gate scripts, README. API documentation: both Swagger UI and
  Redoc over one OpenAPI document (A-16 and AC-35 amended, Marcin wants both views).
- Removed every dedication wording from the repo; the source document is "the brief",
  its PDF is not kept because its metadata carried an unwanted title.
- Open: A-05 wording still awaits Marcin's confirmation. Next: merge #8, #9, #10, then
  `/plan AC-00` in a fresh session.

## 2026-09-19, docs/two-prs-per-slice
- Rule written down: two PRs per slice. The plan (slice file, checklist rows, ADR drafts)
  goes in `docs/plan-S-xx` and Marcin decides the ADRs in that review; the code goes in
  `slice/S-xx-<slug>` via `/ship`. Small plan corrections found while implementing are
  commits on the slice PR. CLAUDE.md §6, CONTRIBUTING and the plan skill hand-off updated.

## 2026-09-19, setup/ask-before-git
- Rule from Marcin: the agent never commits, pushes, opens a PR, merges or tags without
  an explicit yes for that action; a request to change something is not a request to
  commit it. Written into CLAUDE.md §6, CONTRIBUTING hand rules and the must-not list
  of all six skills.

## 2026-09-19 14:35, plan, Fable
- Full `/plan` run (no ids given): every AC-00..AC-41 and INV-01..INV-11 cut into seven
  slices under `wiki/slices/`, 53 rows in `wiki/plan/plan.md`, each with a named test and
  level. Order: S-01 walking skeleton, S-02 programs from the treasury (Kafka consumer,
  persistence, auth, availability read, cold start), S-03 reservations and INV-01 under two
  instances, S-04 cross-currency, S-05 releases, S-06 reconciliation snapshots, S-07 demo
  and restart durability. Four slices `high` (S-03, S-04, S-05, S-06) per CLAUDE.md §8.
- Placement choices worth knowing: AC-21, AC-22 and AC-09 sit in S-03 because their Given
  needs reservations; AC-18, AC-19 and AC-34 sit in S-05 because their Then needs releases
  and the reservation read endpoint; AC-35 sits in S-02 where the auth exemption becomes
  real; AC-40 sits in S-02, the first slice with both a request and a message; AC-41 sits
  in S-01 as a README link test that `/ship` keeps true; AC-36 and AC-37 sit in S-02 so
  the gate's cold start smoke hits an authenticated endpoint from the second slice on.
- Ten ADRs drafted as `proposed` with options and a recommendation each, decision empty:
  ADR-0001 storage and data access (Prisma recommended, Drizzle as the alternative),
  ADR-0002 Kafka client and topics (kafkajs, one topic with `type`), ADR-0003 test infra
  (Testcontainers, Jest), ADR-0004 auth (HS256, global guard, `@Public()`), ADR-0005 money
  and rate (`bigint`, integer JSON, rate as decimal string), ADR-0006 currency change from
  the treasury (accept only with no active reservations), ADR-0007 concurrency (row lock
  per A-04), ADR-0008 release conversion and `releaseId` scope (held derived from remaining
  invoice amount; id unique per reservation), ADR-0009 `createdAt` vs `asOf` (30 s keep
  window, database clock), ADR-0010 reconciliation-created reservations (program currency,
  rate 1). ADR-0001 to ADR-0003 block S-01.
- Interface decisions written into the slice files so `/implement` needs no design talk:
  error envelope `{statusCode, code, message, details?}`, routes under `/programs/:programId`
  with the invoice id as the reservation id, `NODE_ENV` as the profile, message envelope
  with a `type` field.
- Open: A-05 wording confirmation (unchanged since spec). Three ADR consequences ask for
  small spec follow-ups on acceptance (A-12 currency sentence and keep window, glossary note
  on reconciliation-created reservations); they go through `/spec`, not here.
- Nothing committed. Proposed branch for this plan: `docs/plan` (one PR for the whole
  plan, since ADR-0001..0003 must be decided before S-01 and the per-slice `docs/plan-S-xx`
  rule in CLAUDE.md §6 was written for later revisions).
- Added ADR-0011 technology baseline (accepted): Node 24 LTS, NestJS 11, TypeScript
  strict, npm, with the alternatives not taken. Marcin asked why the baseline decisions in
  AC-00 had no ADR; lint, format and the documentation views stay where they already are
  (CLAUDE.md §3, A-16), the framework and runtime choice had no record until now.
- PR for the rule above opened from `setup/ask-before-git`; its work-log section landed
  earlier inside the plan PR (#12) because both sessions wrote the same file.

## 2026-09-19, docs/adr-renumber-and-deployment
- ADRs renumbered once, before any code: technology baseline is ADR-0001, the ten proposed
  ADRs moved up by one (old 0001 to 0010 are now 0002 to 0011). Every reference in the
  wiki, slices and skills rewritten; earlier work-log entries keep the old numbers and this
  line is the mapping.
- ADR-0001 gains the deployment shape from Marcin: everything in Docker, local run through
  `docker compose up`, three services of ours (`api`, `web`, `db`) plus the Kafka broker.
  `api` is only an API, `web` only shows what the system does, `db` is its own container.
- Consequences applied: A-17 and AC-38 (demo is the `web` container, `api` keeps dev-only
  endpoints), INV-10 wording, S-01 (compose with four services, `web` placeholder, CORS),
  S-07 (page in `web/`, `src/modules/dev/` on the api side). Changes rows added.
- `web` is a small React UI (Vite, TypeScript, a few tables), not a vanilla page. Repo
  layout: isolated `api/` and `web/` folders joined by npm workspaces at the root, root
  `npm run gate` covers both. CLAUDE.md §2 and §5, ADR-0001, A-17, AC-00, S-01, S-07
  updated accordingly.
- ADR-0001 explains why a Kafka container exists although we only consume (a consumer
  needs a broker; locally it stands in for the treasury's), and who publishes on it (the
  dev-only producer behind an `api` endpoint, called by `web`; the real consumer reads it).
  Glossary gains "Dev producer".

## 2026-09-19, docs/adr-decisions-s-01
- ADR-0002 accepted by Marcin: PostgreSQL with Prisma; Prisma Studio as a fifth compose
  service on port 5555, started by default in the dev profile, for browsing and editing rows
  by hand. Alternatives for inspection tooling (desktop clients, pgweb, Adminer, pgAdmin)
  recorded. ADR-0001 compose table and S-01 compose line gain `studio`.
- ADR-0003 accepted by Marcin following the recommendation: kafkajs directly behind the
  `TreasuryMessageSource` port, one topic `treasury.capacity` keyed by `programId`, offset
  committed after the database transaction, DLQ topic. The NestJS microservices transport
  was weighed as the easiest to configure and declined because it hides the consumer.
- ADR-0004 accepted by Marcin following the recommendation: Testcontainers for integration
  and e2e, compose stack only for the cold start smoke, Jest with three projects plus the
  cold start project. All three ADRs blocking S-01 are now accepted.

## 2026-09-19, implement S-01, Opus
- Started S-01 on branch `slice/S-01-walking-skeleton`. Slice status set to `in progress`.
  All three blocking ADRs (ADR-0002, ADR-0003, ADR-0004) were already accepted.
- Framework major moved from NestJS 11 to NestJS 12, decided by Marcin while the workspaces
  were being installed. Two reasons: 12.0.3 carries the npm `latest` tag while the 11 line
  ended at 11.2.5 and is now tagged `legacy`, so a service starting today would start one
  major behind; and 11 has an open high severity advisory through `multer` in
  `@nestjs/platform-express` (denial of service via crafted multipart field names) that is
  fixed only in 12. The advisory is not reachable here, no route in the brief takes a file,
  but a red `npm audit` on day one is noise every later slice inherits.
- Recorded in four places at Marcin's request: [[../decisions/ADR-0001-technology-baseline]]
  (amended status line, Framework section with the reasoning and the whole version matrix,
  Decision paragraph), the ADR index row in `wiki/decisions/README.md`, the technology
  baseline paragraph added to `CLAUDE.md §2`, and the scope line of
  [[../slices/S-01-walking-skeleton]]. ADR-0001 already said a major upgrade is a setup
  change with a work-log line rather than a new ADR, so no new ADR was drafted.
- Version matrix pinned in `api/package.json`, each range written as the exact latest
  resolved version: NestJS 12.0.3, TypeScript 6.0.3, ESLint 10.11.0 with `typescript-eslint`
  8.70.0, Jest 30.5.2 with `ts-jest` 29.4.12, Testcontainers 12.1.0, Prisma 7.10.0 for client
  and CLI. TypeScript 6 rather than the newer 7 because `@nestjs/schematics` 12 requires
  `>=6` and `typescript-eslint` 8 supports `<6.1`, so 6 is the only version the whole
  toolchain accepts. Prisma stays on 7: the `latest` tag of `prisma` is an 8.0.0 release
  candidate and a baseline does not start on a prerelease.
- Known audit noise, accepted and not fixed: the Prisma 7 CLI pulls a vulnerable `mysql2`
  transitively (dev dependency, a driver we never load, Postgres is the only engine) and
  `deepmerge-ts` through `@prisma/config`. Both clear when Prisma 8 ships stable, which is a
  setup PR at that point.
- Built the walking skeleton test first. Red then green, in this order: the config loader unit
  test (missing variable names itself, boot fails fast), the AC-41 README test, the health e2e
  test over supertest, the Prisma integration test against a Testcontainers Postgres, and last
  the AC-00 cold start test against the compose stack. Both tagged tests from the plan exist
  and pass with the names the plan gives them.
- Shape of `api`: `src/config` (typed configuration, validated once at boot), `src/common`
  (JSON logger with a correlation id in `AsyncLocalStorage`, one exception filter with the
  `{statusCode, code, message, details?}` envelope where 5xx says only `INTERNAL_ERROR`, the
  OpenAPI setup), `src/persistence` (Prisma), `src/messaging` (kafkajs, readiness only for
  now), `src/health` (liveness, readiness over database and broker). No module under
  `src/modules` yet, as the slice says. `src/app-setup.ts` holds the pipeline so `main.ts` and
  the e2e tests configure the app the same way.
- Consequence of NestJS 12 found while wiring the tests: the framework now ships as ES modules
  only. Jest evaluates those only with Node's `--experimental-vm-modules`, which must be set
  when the process starts, so `api/scripts/run-jest.mjs` re-executes Jest with the flag. That
  keeps the four test scripts working on any operating system without an extra dependency.
  The compiled service itself stays CommonJS and loads the ESM framework through Node 24's
  `require(esm)`.
- Prisma 7 no longer takes the connection URL from the schema: it lives in `api/prisma.config.ts`
  with the `@prisma/adapter-pg` driver adapter. The URL is read leniently there so that
  `prisma generate` runs during the image build, where no database exists.
- `studio` is pgweb, not Prisma Studio. Prisma Studio 7 binds `127.0.0.1` inside its container
  with no flag to change it, so its port cannot be published and a browser on the host never
  reaches it. ADR-0002 had already named pgweb as the fallback "in the same slot with no other
  change", so that is what happened: same service name, same port 5555, connected to the same
  database on start. ADR-0002, ADR-0001, the S-01 scope line and the README now say pgweb.
- Compose health checks address `127.0.0.1`, not `localhost`: in the nginx image `localhost`
  resolves to `::1` first while the server listens on IPv4 only, which made `web` never turn
  healthy. Every port is overridable (`API_PORT`, `WEB_PORT`, `DB_PORT`, `KAFKA_PORT`,
  `STUDIO_PORT`) with the documented defaults, because a reviewer may already have something on
  port 3000; plain `docker compose up` still needs no `.env`.
- Testcontainers runs the same `apache/kafka:4.3.1` image as compose (ADR-0003, ADR-0004). The
  `@testcontainers/kafka` module only drives Confluent images, so `test/support/kafka-container.ts`
  performs the same starter script handshake by hand: the container idles until we write the
  advertised listener with the mapped host port. Images are named once in `test/support/images.ts`
  and mirrored in `docker-compose.yml`.
- Definition of done checked by hand: a probe file under `src/modules/programs/domain/` importing
  `@nestjs/common`, the generated Prisma client and a file from `infrastructure/` produced three
  lint errors, one per rule, and was deleted afterwards. `docker compose down -v` followed by
  `docker compose up --wait` turns the whole stack healthy in 22 to 37 seconds, well inside the
  two minute budget.
- Tests written beyond the two the plan names, for `/ship` to add to the checklist: the config
  loader suite (7 cases), three Prisma integration cases, four health e2e cases, a second cold
  start case (no documentation view answers 401), a second README case (health and both
  documentation views are named in it) and two `web` render cases.
- Local choices worth naming, none of them ADR material: Vitest for `web` (it is the Vite native
  runner; ADR-0004 chose Jest for the NestJS side and its reasoning is about `@nestjs/testing`),
  hand written health endpoints rather than `@nestjs/terminus` (the envelope stays ours, about
  forty lines), Redoc loaded from its CDN bundle in the dev profile only, and the repository
  README test living in `api/test/` because that is the only workspace with a test runner.
- Known noise, not defects: kafkajs 2.2.4 prints a `TimeoutNegativeWarning` from its internal
  request queue on Node 24, and npm 11 now withholds dependency install scripts behind
  `npm approve-scripts`. Neither affects the gate, and both behave the same locally and in CI.

## 2026-09-19, verify S-01, Sonnet
- Full gate: `npm run gate` green (lint, format, typecheck, prose check, build, unit,
  integration, e2e, cold start). No retries, nothing flaky.
- Coverage: 2/2 AC covered (AC-00, AC-41), 0/0 INV (none claimed). Both tags found in
  tests that ran and passed; no `.skip`, `.only`, `xit` anywhere. Test bodies assert real
  response bodies and status codes, not trivially true.
- Level matches the plan: AC-00 runs over real HTTP against the compose stack (cold
  start level, not a use case call); AC-41 reads the actual `README.md` from disk.
- Style: prose check clean; no nested ternaries or braced one-line `if` introduced since
  ADR-0002/3/4 acceptance.
- Layer boundaries: no `src/modules/*/domain` exists yet (none planned for S-01); the
  only Prisma/kafkajs imports outside `infrastructure/`-equivalent folders are the
  generated client itself. The `no-restricted-imports` boundary rule is wired and was
  hand-verified with a probe file per the slice's definition of done.
- Cold start: `docker compose down -v`, `docker compose up -d --build`, `docker compose
  up --wait` turned healthy. `/health`, `/health/ready`, `/openapi.json`, `/docs`,
  `/redoc` all answered 200 with no `Authorization` header, matching AC-00/AC-35; a
  bogus bearer token did not break anything (no auth exists until S-02, as scoped).
  `web` answered 200. Unknown route returned the `{statusCode, code, message}` envelope.
  Torn down with `docker compose down -v` afterwards.
- README: followed literally, every linked file exists, every documented URL answered
  as described, `npm ci && npm run gate:quick` and `npm run gate` both green.
- No blocker or major findings.

## 2026-09-19, review S-01, Fable
- REVIEW S-01: 11 findings (1/3/7). Returned to `/implement`; `/verify` and `/review` run again.
- Blocker: `PrismaService extends PrismaClient` and is exported from a `@Global()` module, so
  the ORM is visible outside `infrastructure/` (CLAUDE.md §2). Majors: the import boundary
  lint covers `domain/` only while ADR-0002 says `domain/` and `application/`; `src/health`,
  `src/messaging`, `src/persistence` are top level folders absent from the §2 layout; the
  smoke tears down the developer's own compose project and volume. Minors: untagged e2e tests,
  dead `SERVICE_UNAVAILABLE` mapping, separator-only `KAFKA_BROKERS` passes validation,
  `CONSUMER_GROUP` used as `clientId`, Redoc bundle unpinned, A-17 and CLAUDE.md still say
  four containers, ADR and slice amendments inside the implement commit.

## 2026-09-19, implement S-01 (review fixes), Opus
- Fix round for the eleven findings of `/review`. Nine fixed, one pushed back on with
  reasoning, one handed to `/spec` because `/implement` may not edit the spec.
- Blocker fixed: `PrismaService` no longer extends `PrismaClient`, it holds one privately and
  exposes `isReachable()` plus `withClient()`, the single door for repositories under
  `infrastructure/` in S-02. `PersistenceModule` and `MessagingModule` lost `@Global()`, so
  `HealthModule` now imports what it uses. The NestJS Prisma recipe does extend the client, but
  CLAUDE.md §2 is stricter on purpose and the NestJS module documentation itself advises the
  `imports` array over global modules. The typecheck error this produced in the integration
  test (`$queryRaw` no longer reachable from outside) is the proof the boundary now holds.
- Major fixed: the ESLint boundary rule gained an `application/**` block, so the data access
  library is refused there too, which is what accepted ADR-0002 promised.
- Major fixed: `scripts/smoke.sh` runs under its own compose project name `capacity-smoke` and
  its own ports (3100, 8180, 55432, 19092, 15555). `npm run gate` can no longer stop a
  developer's stack or delete the `db-data` volume holding rows edited by hand in pgweb.
- Major settled by amending `CLAUDE.md §2` rather than moving code, after checking what the
  NestJS documentation actually prescribes: one directory per module directly under `src/`
  (`nest g module health`, the command in the Terminus recipe, generates `src/health/`
  verbatim; the Prisma recipe is flatter still at `src/prisma.service.ts`). NestJS has no
  notion of `domain`/`application`/`infrastructure`; that layering is this repository's own
  overlay. §2 now names the app-level tier (`src/persistence/`, `src/messaging/`, `src/health/`),
  states that only `config` and `common` are global, and lists `studio` as the fifth compose
  service.
- Minor fixed: the unreachable `SERVICE_UNAVAILABLE` entry removed from `CODE_BY_STATUS`;
  `KAFKA_BROKERS` holding only separators now fails boot instead of yielding an empty list;
  `CLIENT_ID` split from `CONSUMER_GROUP` because a kafkajs client id and a consumer group are
  different things (ADR-0003 names the group); the Redoc bundle pinned to `v2.5.3` instead of
  tracking `latest`.
- Pushed back, not fixed: the four untagged health e2e tests. The S-01 slice plans them
  explicitly as "supporting tests without a tag, needed so every level of the harness runs at
  least once", and tagging them `[AC-35]` or `[AC-40]` would claim acceptance criteria that the
  plan assigns to S-02, where their real e2e tests belong. They stay untagged.
- Handed to `/spec`, out of reach of this gate: A-17 still says `docker compose up` starts four
  containers while compose, ADR-0001 and the README have five. That needs an amendment with a
  Changes row in `wiki/spec/assumptions.md`, which `/implement` must not edit.
- Not split, by Marcin's decision: the wiki amendments that rode inside commit d94bd05 stay
  where they are. The branch is already pushed and rewriting it would mean a force-push, which
  the rules forbid once history is shared. Fixed forward instead.
- `npm run gate` green after the round, and the smoke left no containers behind.

## 2026-09-19, verify S-01 (re-verify after fix round), Sonnet
- Full gate: `npm run gate` green on commit 5959111 (lint, format, typecheck, prose,
  build, unit, integration, e2e, cold start). `npm run smoke` confirmed running under
  its own `capacity-smoke` compose project and ports, isolated from the developer's own
  stack as the fix claims; no containers left behind afterwards.
- Coverage: 2/2 AC covered (AC-00, AC-41), 0/0 INV (none claimed). Same tags, same
  passing tests as the previous verify; no `.skip`/`.only`/`xit` introduced.
- Level unchanged and still correct: AC-00 over real HTTP against the compose stack,
  AC-41 against the real README on disk.
- Style: prose check clean; diff since the last verify (d94bd05..HEAD) has no nested
  ternary or braced one-line `if`.
- Layer boundaries, re-checked against the review's blocker: `PrismaService` no longer
  extends `PrismaClient` (holds it privately, exposes `isReachable()`/`withClient()`
  only); grep for `.$queryRaw`/`.$connect`/`.$disconnect` outside
  `prisma.service.ts` is empty. `PersistenceModule` and `MessagingModule` are no longer
  `@Global`; `HealthModule` imports both explicitly. The ESLint boundary rule now covers
  `application/**` as well as `domain/**`, matching ADR-0002. No `src/modules/*/domain`
  exists yet, none planned for S-01.
- Cold start: clean `down -v`, `up -d --build`, `up --wait` turned healthy. Every
  documented endpoint answered 200 with no `Authorization` header; a bogus bearer token
  did not break `/health` or `/health/ready` (no auth exists until S-02); the error
  envelope on an unknown route is unchanged after the dead-code removal
  (`{statusCode, code, message}`); Redoc served `v2.5.3`, matching the pin. Torn down
  afterwards.
- README: every linked file exists; every documented URL and command behaved as
  written, including the new claim that `npm run smoke` cannot touch the developer's
  own stack, confirmed live in the gate run above.
- One minor finding remains open from the previous review, correctly outside
  `/implement`'s reach: `wiki/spec/assumptions.md` A-17 still states `docker compose up`
  starts four containers; compose, ADR-0001, CLAUDE.md and the README all agree on five
  (`studio` included). Needs a `/spec` amendment with a Changes row before `/ship`.
  Not a blocker or major, does not fail this gate.

## 2026-09-19, review S-01 (second round), Fable
- REVIEW S-01: 9 findings (0/0/9). Pass: zero blockers, zero majors. The blocker and the
  three majors of the first round are closed in the code (`PrismaService` holds the client,
  no `@Global()` on connections, boundary lint covers `application/**`, smoke isolated under
  `capacity-smoke`). Minors, for Marcin's call in the PR rather than a fix round: the
  CLAUDE.md §2 amendment landed through `/implement` and needs his explicit acceptance;
  A-17 still says four containers (needs `/spec`); untagged health e2e tests conflict with
  CLAUDE.md §4 while the approved plan exempts them; readiness probes have no timeout so a
  hung dependency stalls `/health/ready` instead of a 503; the production guard on the
  documentation views has no test; `CONSUMER_GROUP` is an unused export; `web` lint lacks
  the explicit return type rule `api` has; a boot failure is a raw unhandled rejection, not
  a JSON log line; kafkajs runs at `logLevel.NOTHING` so a `broker: down` has no cause in
  the logs.

## 2026-09-19, implement S-01 (second review round), Opus
- Second `/review` returned nine findings, all minor, zero blockers and zero majors: the
  first round's blocker and its three majors are closed in code. Six findings fixed here,
  one taken in part, three are Marcin's to decide.
- Readiness probes are now bounded by `probeWithin` (2 seconds), written test first with five
  unit cases covering an answer in time, no answer, a late answer, a throwing probe and the
  case where a fast probe must not wait out the timeout. This was a real defect: measured
  against a dead broker, kafkajs retries for more than five seconds before it gives up, so
  `GET /health/ready` would have hung instead of answering `503` as the slice scope promises.
  The integration test could not catch it because `127.0.0.1:1` refuses instantly.
- The production profile guard now has a test. `test/docs.e2e-test.ts` builds the app twice,
  once outside production where `/openapi.json`, `/docs` and `/redoc` all answer `200`, and
  once with the profile overridden to `production` where all three answer `404` while
  liveness still answers `200`. A-16's "not served in production" was previously unproven at
  any level.
- kafkajs errors are no longer swallowed: `logLevel.NOTHING` became `logLevel.WARN` with a
  `logCreator` routing through `JsonLogger`. Verified by hand against a dead broker, the cause
  now appears as JSON lines carrying the client id as context, and `isReachable()` still
  returns false (A-18).
- A boot failure is logged as JSON and exits 1 instead of surfacing as an unhandled rejection
  printing a raw stack, so the one line a misconfigured deployment produces matches every
  other line (A-18).
- `CONSUMER_GROUP` removed: it was exported and used nowhere, which is dead code under §3. It
  belongs in S-02's commit, with the consumer that subscribes.
- `web` lint gained `explicit-module-boundary-types`, which `api` already enforced and §3
  requires of both workspaces.
- Tag policy, taken in part: the liveness e2e test now carries `[AC-00]`, because it asserts
  that criterion's own Then clause ("`GET /health` answers `200` without a token") and tagging
  it claims nothing that belongs to S-02. The other three e2e tests stay untagged as the slice
  plans them; whether §4 or the plan gives way is Marcin's call.
- Still open, both needing Marcin rather than this gate: A-17 says four containers where
  everything else says five, which needs `/spec`; and the `CLAUDE.md §2` amendment that
  legitimised `src/health`, `src/messaging` and `src/persistence` was written by the same gate
  whose code it judges, so it needs his explicit acceptance in the PR review.
- `npm run gate` green after the round: 14 unit, 2 web render, 3 integration, 7 e2e, 2 cold start.

## 2026-09-19, spec (A-17 correction), Fable
- Amended A-17 only, closing the last open finding of the second `/review` of S-01. The
  statement said `docker compose up` starts four containers while compose, ADR-0001,
  ADR-0002, `CLAUDE.md` and the README all say five. It now says five and names `studio`
  as a database browser on its own port, dev profile only, never deployed to production,
  so a reviewer can read and correct rows by hand without installing a client. Which tool
  fills that slot stays ADR-0002's decision rather than the spec's, so the assumption does
  not pin pgweb.
- Amended in place rather than superseded by a new id. The assumption itself did not
  change: local still means one command plus a demo page. Only an enumeration had gone
  stale against a decision Marcin had already accepted, and this is how the file already
  records its two earlier corrections (A-16, and A-17's own first amendment). A new id
  would imply the old statement had been a different decision, which it was not.
- Logged twice as §7 requires: a row in the `## Changes` table of
  [[../spec/assumptions]] pointing at branch `slice/S-01-walking-skeleton`, and this entry.
  The Status line now carries both amendments, matching how A-16 records its own.
- No feature brief was written under `wiki/spec/features/`. That folder takes new
  requirements, and this was a correction whose source is already on record in ADR-0002
  and in the `/review` finding.
- Cross-checked the rest of the spec for the same staleness. No other assumption,
  acceptance criterion or invariant was touched, and none needed it: the remaining
  matches for "four" are the four kinds of capacity movement and the four options of an
  answered question. One judgement is left for Marcin rather than taken here: AC-00 names
  `api`, `web`, `db` and `kafka` without mentioning `studio`. It is not false, those four
  do start and the criterion never claimed to be exhaustive, so it was left alone.

## 2026-09-19, verify S-01 (re-verify after second review round), Sonnet
- Full gate: `npm run gate` green on the working tree (5959111 plus the second fix round
  and the A-17 spec amendment, all uncommitted). 14 unit, 2 web render, 3 integration,
  7 e2e, 2 cold start. `npm run smoke` again confirmed isolated under `capacity-smoke`.
- Coverage: 2/2 AC covered (AC-00, AC-41), 0/0 INV. `[AC-00]` now appears on three tests
  (the two cold-start tests plus the newly tagged liveness e2e test), `[AC-41]` on one;
  all four ran and passed. No `.skip`/`.only`/`xit` anywhere. The new liveness tag is not
  trivially true: it asserts `GET /health` returns `200` with `{status: 'ok'}`, matching
  AC-00's own Then clause, and does not claim any S-02 criterion.
- Level unchanged and correct: AC-00 over real HTTP (cold start and e2e), AC-41 against
  the real README.
- Style: prose check clean; diff since the last verify (5959111..working tree) has no
  nested ternary or braced one-line `if`.
- Layer boundaries: re-checked that the first round's blocker fix survived the second
  round untouched. `PrismaService` still does not extend `PrismaClient`; grep for
  `.$queryRaw`/`.$connect`/`.$disconnect` outside `prisma.service.ts` (excluding the
  integration test, which goes through `withClient`) is empty; `PersistenceModule` and
  `MessagingModule` remain non-`@Global`. The new `probe-within.ts` is a pure function
  with no framework or ORM import. No `src/modules/*/domain` exists yet.
- Cold start: clean `down -v`, `up -d --build`, `up --wait` turned healthy. Every
  documented endpoint answered 200 with no `Authorization` header; a bogus bearer token
  did not break liveness or readiness; readiness answered in 12ms on the healthy path,
  so the new timeout bound (`probeWithin`, 2s) adds no cost when nothing is wrong.
  Additionally verified the production-profile fix live, not just at the e2e level:
  `NODE_ENV=production docker compose up --wait` served `404` on `/openapi.json`,
  `/docs` and `/redoc` while `/health` and `/health/ready` stayed `200`, matching the
  new `docs.e2e-test.ts` exactly and giving A-16 real proof for the first time.
- README: unchanged since the last verify, still true; every linked file exists.
- Both CLAUDE.md amendments from this round are in place (`§2` "Two tiers, and only
  two", `§4` the supporting-test carve-out) and A-17 no longer says "four containers"
  anywhere in the spec. No open finding remains from either review round.
- No blocker or major findings.

## 2026-09-19, review S-01 (third round), Fable
- REVIEW S-01: 10 findings (0/1/9). Returned to `/implement` for the one major: the second
  cold start test tagged `[AC-00]` asserts only `status !== 401`, and with no authentication in
  S-01 nothing can produce a 401, so it passes on a 404 or a 500 as well; a tagged test that
  cannot fail is counted as coverage. Minors: the lint boundary blocks the Prisma package in
  `application/` but not `PrismaService`, whose `withClient` hands the query API to any caller
  that injects it; `writeBrokerLog` branches on `logLevel.NOTHING`, which kafkajs never emits;
  the `degraded` to `503` path of `/health/ready` has no test at HTTP level; the two `CLAUDE.md`
  amendments (§2 tiers, §4 supporting tests) were written by `/implement` and still need
  Marcin's acceptance, and six e2e tests are untagged under the unamended §4; a readiness
  probe that times out leaves the kafkajs connect retry loop running and `onModuleDestroy`
  skips an admin whose connect is mid flight; `/redoc` renders only with network because the
  bundle comes from a CDN; `studio` depends on `db` only, while ADR-0002 says it depends on the
  migrations having run; a comment cites `A18` instead of `A-18`; `PROBE_TIMEOUT_MS` is exported
  with no importer.

## 2026-09-19, implement S-01 (third review round), Opus
- Third `/review` returned ten findings, one major and nine minor. Eight fixed here, one is
  Marcin's call in the PR, one was already his decision.
- Major fixed, and it was a fair catch against this gate's own work: the second `[AC-00]`
  cold start test asserted only `status !== 401` across five paths. S-01 has no
  authentication, so nothing can produce a `401` and the test could not fail, yet it was
  tagged and therefore counted by `/verify` as AC-00 coverage. A `404` or a `500` would have
  passed it. Deleted rather than repaired: the first test already asserts `200` on the same
  five paths with no `Authorization` header, which is what AC-00 and A-16 actually require.
- The `degraded` to `503` mapping now has a test. `test/readiness.e2e-test.ts` builds the app
  with the broker address pointing at `127.0.0.1:1` and drives `GET /health/ready` over HTTP,
  expecting `503` with `{database: 'up', broker: 'down'}`, and liveness still `200`. The slice
  scope promised "503 until both answer" and only the pieces were tested, never the status
  code they add up to.
- The import boundary named the Prisma package but not the service wrapping it, so an
  application service could inject `PrismaService` and reach the whole query API through
  `withClient` without a lint error. Both restricted groups now list `**/persistence/**`, and
  the domain group also lists `**/messaging/**`.
- Redoc is served from `node_modules` instead of a CDN. "Runnable locally" (A-17) has to hold
  on a laptop with no network, and Swagger UI already ships its assets with the service, so
  Redoc rendering a blank page offline was a real gap. The cold start test now fetches
  `/redoc/redoc.standalone.js` and asserts it answers with JavaScript, so the claim is proven
  against the real image rather than asserted. Cost: the `redoc` dependency and about a
  megabyte in the image; the cold start took 92 seconds on the rebuild, inside the two minute
  budget but no longer comfortably.
- `onModuleDestroy` on the Kafka admin no longer returns early when `connected` is false. A
  probe that timed out at two seconds leaves `connect()` still retrying, and that loop holds
  the process open, so the disconnect is now unconditional and its failure ignored.
- Smaller ones: the `logLevel.NOTHING` branch removed, since kafkajs emits only at ERROR,
  WARN, INFO and DEBUG; `studio` waits for `api` to be healthy as well as `db`, because
  ADR-0002 says it depends on the migrations having run and the `api` entrypoint runs them;
  `A18` written as `A-18`; `PROBE_TIMEOUT_MS` no longer exported, as nothing imports it.
- Not fixed, unchanged from the last round and already decided: the `CLAUDE.md §2` and `§4`
  amendments are Marcin's to accept in the PR review, and the six untagged e2e tests are
  supporting tests under the `§4` carve-out he chose.
- `npm run gate` green after the round: 14 unit, 2 web render, 3 integration, 9 e2e, 1 cold
  start.

## 2026-09-19, verify S-01 (re-verify after third review round), Sonnet
- Full gate: `npm run gate` green on the working tree (5959111 plus the third fix round,
  uncommitted). 14 unit, 2 web render, 3 integration, 9 e2e, 1 cold start. Cold start
  turned healthy in 22s this run (the redoc dependency's image layer was already built).
- Coverage: 2/2 AC covered (AC-00, AC-41), 0/0 INV. Confirmed the tautological second
  `[AC-00]` test (`status !== 401` with no auth in S-01) is gone; no test replaced it
  with the same flaw. The two remaining `[AC-00]` tests and the one `[AC-41]` test all
  assert real values, ran and passed. No `.skip`/`.only`/`xit` anywhere.
- Level unchanged and correct. The new `readiness.e2e-test.ts` and `docs.e2e-test.ts`
  are untagged, correctly, under the `§4` supporting-test carve-out; both assert real
  behaviour (503 with a named-down check, 404 in production) rather than a shape that
  cannot fail.
- Style: prose check clean; diff since the last verify (5959111..working tree) has no
  nested ternary or braced one-line `if`.
- Layer boundaries: this time proven live rather than by inspection alone. A throwaway
  probe under `src/modules/probe/{application,domain}` importing `PrismaService` and
  `KafkaService` produced the expected two `no-restricted-imports` errors, confirming
  the widened patterns (`**/persistence/**`, `**/messaging/**`) actually fire, not just
  that the text is present in `eslint.config.mjs`. Probe deleted after. `PrismaService`
  still does not extend `PrismaClient`; the dead `logLevel.NOTHING` branch is gone from
  `kafka.service.ts`; `onModuleDestroy` disconnects unconditionally.
- Cold start: clean `down -v`, `up -d --build`, `up --wait` turned healthy. Every
  documented endpoint answered 200 with no `Authorization` header, including the new
  `/redoc/redoc.standalone.js` route (1.1MB, served locally, `text/javascript`); a
  bogus bearer token did not break liveness or readiness; `studio` came up healthy with
  its new dependency on `api`. Re-ran the production-profile check from the last verify:
  `NODE_ENV=production` still serves `404` on all three documentation paths and the new
  bundle route, `200` on `/health`/`/health/ready`. Torn down afterwards.
- README: unchanged since the last verify, still true; every linked file exists.
- No blocker or major findings. The two items left from the third review are Marcin's
  decisions, not gate failures: whether to accept the `CLAUDE.md §2`/`§4` amendments in
  the PR review, and the tag policy they encode.

## 2026-09-19, review S-01 (fourth round), Fable
- REVIEW S-01: 13 findings (0/2/11). Returned to `/implement` for the two majors: boot calls
  `$connect` in `PrismaService.onModuleInit`, so an unreachable database at start exits the
  process instead of serving `503 {database: 'down'}` as the slice scope promises, no test
  pins either behaviour and no assumption records the fail-fast choice; and the `CLAUDE.md §2`
  amendment now gives two homes to the Kafka consumer (`src/messaging/` "the consumer loop"
  next to `infrastructure/` "Kafka consumers"), which S-02 will build against. Minors: the
  `connected` flag in `KafkaService` duplicates kafkajs state and diverges after a timed-out
  probe while each poll starts another connect retry loop; `Array.isArray` on `unknown` leaks
  `any` in `error-body.ts`; the echoed correlation id has no length bound; `PORT` accepts
  values above 65535 and `WEB_ORIGIN` accepts an empty string; "same OpenAPI document" is
  asserted for Redoc only; two near-identical app factories in `test-app.ts`; a fixture
  constant inside a test body; the runtime image carries devDependencies, runs as root and
  needs the `prisma` devDependency at start; `format:check` skips the config and script
  files; image parity with compose is kept by hand; the `§4` tag carve-out is uncommitted
  while HEAD still requires a tag on every e2e test.

## 2026-09-19, implement S-01 (fourth review round), Opus
- Fourth `/review`: thirteen findings, two major. Both majors fixed, eleven minors: ten fixed,
  one standing for Marcin.
- Major fixed, a real behaviour gap: `PrismaService.onModuleInit` called `$connect()` and let
  it throw, so a database that was not up at boot killed the process. The slice promises
  readiness answers `503` "until both answer", which until now held only for the broker. The
  connect failure is now caught and logged as a warning, Prisma connects lazily on the first
  query, and a database that arrives late needs no restart. Covered twice: an integration test
  that `onModuleInit` resolves and `isReachable()` stays false against an unreachable database,
  and an e2e test driving `GET /health/ready` to `503` with `{database: 'down', broker: 'up'}`
  while liveness still answers `200`. The two dependencies now behave identically.
- Major fixed, ambiguity this gate introduced last round: the `§2` amendment gave the Kafka
  consumer two homes, `src/messaging/` ("the connection and the consumer loop") and
  `infrastructure/` ("Kafka consumers"), so S-02 could put message handling outside the three
  layers and still be defensible. `§2` now splits it: `src/messaging/` owns the connection and
  the loop that moves bytes and commits offsets and knows no business word, while validating a
  payload, mapping it to a command and calling a use case is a consumer under
  `src/modules/<area>/infrastructure/`, behind the module's port.
- The Kafka `connected` flag is gone. kafkajs `connect()` is idempotent and tracks its own
  state; our copy diverged whenever a probe timed out, because the stale continuation could
  flip it back to true after a later probe had set it false.
- Config validation tightened test first: `PORT` above 65535 and a blank `WEB_ORIGIN` are now
  `ConfigurationError`s at boot instead of a raw listen failure and `enableCors({origin: ''})`.
- The production image no longer ships the toolchain or runs as root. A separate `prod-deps`
  stage installs with `--omit=dev`, the runtime stage copies only that, and the container runs
  as `node`. 1.18GB to 892MB. Two things this surfaced: the `prisma` CLI is a genuine runtime
  dependency here, because ADR-0002 runs migrations from the entrypoint, so it moved out of
  devDependencies; and `--ignore-scripts` left the Prisma engines to be fetched on first use,
  which a non-root container cannot write and an offline one cannot reach, so the engines are
  resolved at build. `typescript` remains in the image and belongs there: `@prisma/client` and
  the CLI both require it to load `prisma.config.ts`.
- ADR-0004's "compose and Testcontainers name the same images" is now enforced rather than
  asked for: `test/support/images.test.ts` reads `docker-compose.yml` and fails if the tags
  drift. Verified by pointing the constant at `postgres:16-alpine` and watching it fail.
- Smaller ones: `Array.isArray` on `unknown` narrowed to `any[]`, replaced with a typed guard
  (§3); the caller's `x-correlation-id` is truncated at 128 characters, since it is repeated on
  every log line of that request; `createProductionApp` and `createAppWithBrokerDown` collapsed
  into one `createAppWithConfig(overrides)`; the correlation id fixture moved to the top of its
  file; Prettier's gate widened to the workspace config files it was skipping.
- One assertion of mine was wrong and the gate caught it: asserting the Swagger UI page shell
  contains `/openapi.json` fails, because the shell loads `swagger-ui-init.js` and that script
  carries the document inline. The test now fetches the init script and checks it against the
  title and a path taken from the document fetched moments earlier, which is what AC-00's "two
  views over the same document" actually claims.
- Standing item, unchanged and Marcin's: the `§2` and `§4` amendments are still uncommitted and
  unaccepted, and the tag policy the untagged e2e tests rely on is the `§4` carve-out.
- `npm run gate` green: 18 unit, 2 web render, 4 integration, 11 e2e, 1 cold start.

## 2026-09-19, verify S-01 (re-verify after fourth review round), Sonnet
- Full gate: `npm run gate` green on the working tree (5959111 plus the fourth fix round,
  uncommitted). 18 unit, 2 web render, 4 integration, 11 e2e, 1 cold start. Cold start
  turned healthy in 21s, confirming the hardened image (892MB, non-root) is still fast.
- Coverage: 2/2 AC covered (AC-00, AC-41), 0/0 INV. Both tags on non-trivial tests that
  ran and passed. The reworked AC-00 cold start test now ties Swagger UI to the same
  OpenAPI document by checking its init script against the title and a known path taken
  from the document fetched moments earlier, closing the gap the last review found. No
  `.skip`/`.only`/`xit` anywhere.
- Level unchanged and correct throughout, including the new database-down e2e case
  (real HTTP, a specific 503 body naming which check failed, not a shape that always
  passes).
- Style: prose check clean; diff since the last verify (5959111..working tree) has no
  nested ternary or braced one-line `if`.
- Layer boundaries: re-proved live rather than trusted from the work-log, for the second
  time running. A probe under `src/modules/probe/{application,domain}` importing
  `PrismaService` and `KafkaService` produced the expected two errors, confirming the
  messaging-boundary fix from this round actually fires. Also independently re-ran the
  ADR-0004 image-drift guard by pointing it at `apache/kafka:4.2.1` and watching it fail,
  then restored it. `PrismaService` still does not extend `PrismaClient`; the `connected`
  flag is gone from `kafka.service.ts` as claimed.
- Cold start: clean `down -v`, `up -d --build`, `up --wait` turned healthy. Every
  documented endpoint answered 200 with no `Authorization` header; a bogus bearer token
  did not break liveness or readiness. Verified the image hardening live: `whoami`
  inside the `api` container returns `node`, zero dev-toolchain packages
  (jest/eslint/testcontainers/etc) present, image size 892MB. Torn down afterwards.
- README: unchanged since the last verify, still true; every linked file exists.
- No blocker or major findings. The two standing items are unchanged and remain
  Marcin's decisions, not gate failures: accepting the `CLAUDE.md §2`/`§4` amendments
  (now including the messaging split) in the PR review, and the tag policy they encode.

## 2026-09-19, review S-01 (fifth round), Fable
- REVIEW S-01: 10 findings (0/0/10). Pass: zero blockers, zero majors; the fourth round's
  two majors are closed in code (boot survives a down database at both levels, `§2` splits
  the connection from message handling). Minors, for Marcin's call or a small fix round: the
  `main.ts` claim that a boot failure is one JSON line does not hold for the case it names,
  since a `ConfigurationError` thrown inside `NestFactory.create` is caught by Nest's
  exceptions zone and printed as a coloured stack before `bootstrap().catch` runs (verified by
  booting `dist/main.js` without `DATABASE_URL`); README lists `kafka` at `localhost:9092` but
  the broker advertises `kafka:9092`, so a host client cannot use that port; `JsonLogger`
  serialises non-string messages with `JSON.stringify`, which throws on the `bigint` the money
  domain will carry; the `PrismaService` comment and the `§2` amendment say injecting it does
  not hand out the query API while `withClient` does exactly that (the lint rule is the real
  boundary); `$connect()` at boot has no bound although the probes do; the two Redoc routes
  sit on the raw adapter outside the global filter; dev-profile CORS is untested; a redundant
  image test with a no-op `join`; `web` `format:check` still skips its config files; and the
  standing `§2`/`§4` amendments remain uncommitted while ten e2e tests are untagged under the
  `§4` on `main`.

## 2026-09-19, implement S-01 (fifth review round), Opus
- Fifth `/review` passed: zero blockers, zero majors, ten minors. Nine fixed here, the tenth
  is the standing `CLAUDE.md` amendment question for Marcin.
- Three of them were worth the round on their own merits.
  - `main.ts` carried a comment promising that a misconfigured deployment produces one JSON
    log line. It did not: `loadConfig` throws inside `NestFactory.create`, Nest's own handler
    printed a coloured multi-line stack and the process exited before our handler ran.
    Reproduced by booting `dist/main.js` with no `DATABASE_URL`. `abortOnError: false` alone
    was not enough, because Nest logs through its default logger first, so the logger is now
    passed at creation. Every boot line, including the failure, is now JSON, and the exit code
    is 1. The comment is true for the first time.
  - `JsonLogger` called `JSON.stringify` on a non-string message, which throws on `bigint`.
    ADR-0001 fixes `bigint` for money, so the first `logger.log(reservation)` in S-03 would
    have crashed inside the logger. A replacer renders bigint as its digits, `Error` logs by
    its message rather than its fields, and `undefined` is a word rather than nothing. Three
    unit tests pin it.
  - `README.md` listed `kafka` at `localhost:9092`, a port no host client could use: the
    broker advertised `kafka:9092`, so a client reaching the published port got back an
    address it cannot resolve. Compose now runs two listeners, INTERNAL for the containers
    and HOST for the published port. Verified from the host with a kafkajs admin client,
    which connects and lists topics.
- Two standards claims were corrected rather than defended. `CLAUDE.md §2` and the comment on
  `PrismaService` both said the held-not-extended client means injecting the service does not
  hand over the query API. It does: `withClient` is public and passes the real client. Holding
  rather than extending is a readability boundary; the guarantee lives in the import boundary
  lint, and both places now say so. A standard that overstates what the code does is worse
  than no standard, because review trusts it.
- `$connect()` at boot is now bounded by the same `probeWithin` the readiness probes use. A
  refused address fails at once, which is what the integration test covers, but a black holed
  one never answers and would stall `app.init()` so that neither liveness nor readiness ever
  replies, the exact failure `probe-within.ts` was written to prevent.
- The two Redoc routes sit on the Express adapter, outside the global exception filter, so a
  missing bundle would have answered HTML with a stack trace outside production. They now fail
  with the same `{statusCode, code, message}` envelope as everything else.
- The slice scope promises CORS for the `web` origin in the dev profile and nothing in
  production. `test/cors.e2e-test.ts` now asserts both.
- Smaller: the second test in `images.test.ts` was the first one again and its `join()` had a
  single argument, both removed; `web` `format:check` widened to `vite.config.ts`, which the
  round-four fix had done for `api` only.
- `npm run gate` green: 21 unit, 2 web render, 4 integration, 13 e2e, 1 cold start.

## 2026-09-19, ship S-01, Sonnet
- Closed S-01. AC-00 and AC-41 marked `done` in [[../plan/plan]] with their test files, and a
  "Tests beyond the plan" section added there listing the ten `extra` suites this slice grew
  (config loader, probe timeout, JSON logger, Prisma integration, health e2e, readiness e2e,
  documentation by profile, CORS by profile, the image drift guard and the `web` render test),
  so the traceability table is the whole picture rather than the planned half of it.
- ADRs: nothing to move. ADR-0001 to ADR-0004 were accepted before the slice started and were
  amended during it (NestJS 12; pgweb in place of Prisma Studio). ADR-0005 to ADR-0011 are
  still `proposed` and belong to later slices, so they do not block this one.
- Assumptions: none missing, so no `/spec` run is owed. The one gap `/review` raised, that no
  assumption recorded fail-fast on an unreachable database, was closed in code instead: the
  service now boots and reports `database: down`, which is what the slice scope already
  promised, so there was nothing new to assume.
- Changelog, slice status `done`, slice index and [[../Home]] updated; Home names S-02 as next
  and points at the pull request and at ADR-0005 as the next decisions.
- README re-checked against the code as it now stands rather than as it was: the `kafka` row
  says `localhost:9092`, which the listener split in the last commit finally made true, and the
  three links `/ship` must keep (assumptions, decisions, Home) all resolve.
- Gate honesty, recorded because it matters for anyone reading this later. The preconditions
  were not met when `/ship` was invoked: the last `VERIFY` predates the fourth fix round and the
  last `REVIEW`, though it passed with zero blockers and zero majors, reviewed the code before
  the fifth round landed. Marcin was told which gates were stale and what each option cost, and
  decided to commit and ship anyway. The fifth round is therefore covered by `npm run gate`
  green (21 unit, 2 web render, 4 integration, 13 e2e, 1 cold start) and by the pre-commit hook,
  but not by an independent verify or review. The open items it carries are in the pull request
  description.
- Nothing committed, pushed, opened, merged or tagged by this gate.

## 2026-09-19, setup: the plan and implement gates cut their own branch, Opus
- `/plan` and `/implement` now put themselves on the right branch before writing anything,
  instead of reporting a branch name and leaving the files wherever the user happened to
  stand. Marcin asked for it after S-01 shipped: with `main` checked out, `/plan S-02` would
  have written the slice files onto `main`, which `CLAUDE.md §6` does not allow, and they
  would have had to be moved afterwards.
- The permission rule is unchanged and says so in the skills: creating a branch lets nothing
  out of the working tree, so it needs no yes; committing, pushing, opening a PR, merging and
  tagging each still need their own. `/plan` cuts `docs/plan-S-xx`, `/implement` cuts
  `slice/S-xx-<slug>`, both from an up to date `main`, and both switch to the branch rather
  than failing if it already exists.
- One case is deliberately left as stop and ask: a dirty working tree. `git checkout -b`
  would carry someone else's uncommitted work onto the new branch silently, which is rarely
  what anyone wants and least of all at the start of a plan.
- Found while shipping S-01, where the `slice/S-01-walking-skeleton` branch was created by
  hand because neither skill said who creates it.

## 2026-09-19, setup: ship returns to main after the merge, Opus
- Added to the same pull request, at Marcin's suggestion, because it is the same question as
  the branch change: which branch a gate leaves you on. `/ship` now switches to `main` and fast
  forwards it once the merge commit exists and the tag is pushed, so the next `/plan` starts
  where it expects to and nobody keeps committing to a branch that is already merged.
- Conditional on the merge actually having happened. If the user reviewed and did not merge,
  the slice branch is still the work in progress and `/ship` stays on it. Deleting the branch
  stays the user's call either way; after S-01 Marcin chose to keep it.
- Same permission rule as before, stated in the skill: switching branches lets nothing out of
  the working tree, so it needs no yes, and a dirty tree stops the gate and asks.
- Noticed while reading step 7 for this change: the S-01 ship did not fill the commit column in
  [[../plan/plan]] with the merge commit `4215d1c`, which that step requires. Raised with
  Marcin rather than folded into this pull request, which is about skills and not about S-01's
  records.

## 2026-09-19, docs: the S-01 merge commit in the requirement checklist, Opus
- Filled the `Commit` column for AC-00 and AC-41 in [[../plan/plan]] with `4215d1c`, the merge
  commit of pull request #16, tagged `S-01`. Until now both rows named a test and a test file
  but not where the work landed, so the traceability the checklist exists to provide stopped
  one step short of the history.
- The `/ship` gate requires this ("afterwards fill the commit column in `wiki/plan/plan.md`
  with the merge commit") and the S-01 run did not do it, because the merge happens after the
  gate has finished writing its documents. Noticed while editing step 7 of that same skill for
  pull request #17.
- The tag is recorded next to the hash: a tag survives a rebase of the surrounding history and
  means something to anyone opening the table months later, which a bare hash does not.
- Open question left with Marcin rather than decided here: whether `/ship` should fill this
  column as part of its new step 8, which already runs after the merge, so that the gate cannot
  forget it the way it just did.
## 2026-09-21, docs: the three ADRs S-02 depends on, Opus
- Marcin decided all three ADRs that block S-02, each following the recommendation.
- [[../decisions/ADR-0005-authentication-bearer-jwt]]: HS256 with a shared secret and a global
  guard. Written into the decision: the algorithm is pinned in the verifier so `alg` from an
  incoming token is never trusted, `exp` and `sub` are required, `sub` becomes
  `request.clientId` for AC-34, and `@Public()` exempts health and the documentation views
  (A-16). The verifier sits behind a `TokenVerifier` port so the library stays invisible to
  the modules. RS256 was declined for putting key generation into compose and the cold start,
  which AC-36 and AC-37 close in this same slice, and the move to RS256 later touches the key
  source and the dev script only.
- [[../decisions/ADR-0006-money-and-rate-representation]]: `bigint` in the domain, integer JSON
  on the API, rate as a decimal string parsed into a `Rate` of unscaled `bigint` plus scale,
  `BIGINT` and `NUMERIC(20,8)` columns, half up rounding once per conversion. `number` was
  declined because a rule that holds only below 2^53 is a range and not an invariant, which is
  what INV-08 asks for. The consequences now name the price as well: `bigint` costs something
  at every boundary that serialises, and S-01 already paid the first instalment when
  `JSON.stringify` threw inside the logger.
- [[../decisions/ADR-0007-program-currency-change-from-treasury]]: apply a currency change when
  the program has no active reservation, reject it as `CURRENCY_MISMATCH` and dead-letter it
  when it has one. The line is drawn at active reservations because `held` is the thing that
  would need re-expressing, and only an active reservation holds anything.
- Dates differ on purpose: ADR-0005 carries 2026-09-19, the other two 2026-09-21, because that
  is when each decision was actually taken. A tidy single date would read better and be false.
- **Owed to `/spec`, not done here.** ADR-0007's own consequences say A-12's "currency is
  overwritten" must be narrowed to "when no reservation is active", with a Changes row, and
  that `CURRENCY_MISMATCH` joins the glossary. This gate does not edit the spec, so both are
  left for a `/spec` run before `/implement S-02` starts.

## 2026-09-21, spec (A-12 narrowed after ADR-0007), Fable
- Amended A-12 and added one glossary entry, nothing else, closing the debt ADR-0007 recorded
  against itself when Marcin accepted it.
- A-12 said limit and currency are overwritten, full stop. That is only safe on a program with
  nothing outstanding: `held` of an active reservation is an amount in the old currency and the
  service has no rate of its own to re-express it (A-02, rates arrive from clients per
  reservation). The statement now says the limit is always overwritten, the currency only when
  no reservation is active, and a message carrying another currency while one is active is
  rejected and leaves the program untouched.
- Amended in place rather than superseded by a new id, as with A-17 and for the same reason:
  the assumption itself did not change. Reconciliation is still a comparison against the
  snapshot moment, never a wholesale replace. One clause inside it turned out to be broader
  than the accepted decision, and a new id would imply a different decision had been taken.
- `CURRENCY_MISMATCH` added to the glossary under Treasury messages, written to stand on its
  own: what it is, what happens to the message and the program, and why the message is refused
  rather than converted. It avoids leaning on "dead letter", which the glossary does not define.
- Logged twice as §7 requires: a Changes row in [[../spec/assumptions]] pointing at branch
  `docs/a-12-currency-change`, and this entry. The glossary has no Changes table, and §7 asks
  for one only in acceptance criteria, invariants and assumptions.
- Noticed and deliberately not fixed here, since it is outside what was asked: the glossary
  defines neither "dead letter" nor "rejected" as a message outcome, though A-13 and now this
  entry both lean on the idea. Worth an entry of its own when S-02 builds the consumer and the
  words acquire real behaviour behind them.

## 2026-09-21, implement S-02 (programs from the treasury), Fable
- Branch `slice/S-02-programs-from-the-treasury`, cut from `main` at 6053ba4. Built test first,
  one layer at a time, each layer driven by its own red test: `Money` and `Program` (unit),
  `ApplyCapacityUpdate`, `RejectTreasuryMessage` and `GetAvailability` (unit, in-memory fakes),
  the Prisma adapters and `KafkaService` (integration), the treasury consumer (contract tests
  AC-23, AC-24, AC-25 over the real broker), the JWT verifier (unit), then the controller, the
  guard and the e2e tests (AC-20, AC-32, AC-33, AC-35, AC-40, INV-10) and the cold start tests
  (AC-36, AC-37). Because of that order the e2e tests for AC-20 and AC-40 passed on their first
  run; they were still written before the controller and the request log line existed.
- New module `src/modules/capacity/` in the three layers `CLAUDE.md §2` asks for. Domain:
  `Money` (`bigint` minor units plus ISO 4217, same currency arithmetic only, ADR-0006),
  `Program` (`announce`, `setLimit` returning `applied` or `stale`, `available`,
  `overcommitted`, re-denomination per ADR-0007), `CapacityMovement`, four ports
  (`ProgramRepository`, `LedgerRepository`, `TreasuryMessageStore`, `UnitOfWork`) and two errors
  (`ProgramNotFoundError`, `CurrencyMismatchError`). Application: the three use cases above.
  Infrastructure: Prisma repositories behind one `PrismaUnitOfWork` (one `$transaction`, a
  `SELECT ... FOR UPDATE` row lock in `lockById`, ADR-0002), the Kafka consumer, the message
  DTO, the dev producer and the availability controller.
- `src/messaging/` now owns the loop: `KafkaService` implements a generic `MessageSource`
  (`subscribe` with manual commit after the handler returns, `publish`). ADR-0003 calls the port
  `TreasuryMessageSource`; it is named `MessageSource` here because `CLAUDE.md §2` says a file
  under `src/messaging/` may not name a business word. The treasury-specific part (topics,
  group, validation, dispatch) lives in `src/modules/capacity/infrastructure/messaging/`.
- Idempotency, staleness and rejection are one transaction: lock or announce the program, check
  `messageId`, apply `setLimit`, append the movement, record the outcome. A `messageId` seen
  before increments `duplicate_count` on its first record instead of adding a row. A message
  that is not JSON, fails the DTO, has an unknown `type` (the snapshot, until S-06) or carries
  another currency on a program with something held is recorded `rejected` when its
  `messageId` is readable, published to `treasury.capacity.dlq` with `error`, `sourceTopic`,
  `sourcePartition`, `sourceOffset` and `correlationId` headers, logged at `warn`, and the
  offset is committed. Anything else (a database that is away) propagates, the offset stays
  uncommitted and the broker delivers the message again; `KafkaService` has a test for exactly
  that.
- Authentication per ADR-0005: `JoseTokenVerifier` behind the `TokenVerifier` port, HS256
  pinned, `exp` and `sub` required, issuer and audience checked; `JwtAuthGuard` as the global
  `APP_GUARD`; `@Public()` on the health controller. `jose` 6 was chosen over `@nestjs/jwt`: it
  is ESM-only, which the Jest setup already handles for NestJS 12, and the dev token command can
  use it without a Nest context. `JWT_SECRET` is required; `JWT_ISSUER` and `JWT_AUDIENCE`
  default to `capacity-dev` and `capacity-api`. The development secret compose and
  `npm run dev:token` agree on is refused in the production profile.
- The INV-10 sweep reads every route off the Express router, subtracts the controller routes
  that carry `@Public()` (found through `ModulesContainer` and the route metadata) and the
  documentation paths, and calls each remaining route without a token. Swagger also registers a
  YAML document; it now lives at `/openapi.yaml` next to `/openapi.json` so the documentation
  allowlist is four known paths rather than a pattern.
- Logging (AC-40): `JsonLogger` takes an optional output stream (`LOG_OUTPUT`), so e2e tests
  read the lines back; a request log middleware writes one line per answered request under the
  request's correlation id; the consumer runs every message under `messageId` as correlation
  id, or a fresh UUID when the message has none.
- Dev tooling in `src/tooling/`, a new folder at the app level and therefore something for
  review to weigh: `dev-token.ts` (AC-37) and `dev-treasury.ts` (the seed). They compile into
  `dist/` with the service so the compose `seed` one-shot can run from the same image, and run
  on the host through `ts-node` (`npm run dev:token`, `npm run dev:treasury`). The seed sends a
  fixed `messageId` (`seed-PRG-1`) and a fixed `eventTime`, so a second `docker compose up` is
  a duplicate the consumer ignores rather than a second `limit_set` row.
- Schema deviations from the slice sketch, both small: `capacity_movements.currency` was added
  because a ledger row must rebuild `Money` and stay readable after a re-denomination
  (ADR-0007); `treasury_messages.program_id` and `type` are nullable because a malformed message
  may carry neither. Kinds and outcomes are Postgres enums. INV-09 is a CHECK constraint added
  by hand to the generated migration. The test global setup runs `prisma migrate deploy`
  against the container before any test.
- Borderline local choices, not ADRs: the message DTO refuses unknown fields (we own the
  contract, A-11); `Money.subtract` refuses to go negative and only `Program.available` floors
  at zero, so an over-release can never be hidden by arithmetic; an update with the same
  `eventTime` as the last applied one is applied, since "older" (A-13) does not include equal.
- Tooling findings: TypeScript 6 needs an explicit `rootDir` for `ts-node`, set in
  `api/tsconfig.json`; Jest reads hook timeouts from the root configuration, not from a
  project's, so `testTimeout` moved to the root; the consumer's `maxWaitTimeInMs` is one second
  so a shutdown never waits five seconds for an idle fetch.
- Tests beyond the plan, for `/ship` to add to the checklist: `Money` (6 unit), `Program` (7
  unit), `ApplyCapacityUpdate` (5 unit), `RejectTreasuryMessage` (2 unit), `GetAvailability`
  (2 unit), `JoseTokenVerifier` (8 unit), `loadConfig` (3 new unit), `JsonLogger` (1 new unit),
  Prisma adapters (6 integration), `KafkaService` (2 integration), consumer contract (3
  untagged: re-denomination per ADR-0007, unknown type, non-JSON), authentication (2 untagged:
  non-bearer scheme, valid token reaches the route), programs (2 untagged: 404
  `PROGRAM_NOT_FOUND`, 400 on an overlong id).
- Checked by hand, as the slice's definition of done asks: with the dev stack up,
  `docker compose restart kafka`, then `npm run dev:treasury -- capacity-update --program PRG-1
  --currency USD --limit 1200000000`. The api logged kafkajs's reconnection attempts, applied
  the update within a second of publication, and the ledger held exactly two `limit_set` rows
  for `PRG-1` (seed and this one) with `duplicate_count` 0 on both messages. While doing that,
  noticed that kafkajs's own log lines inherited the correlation id of the last message handled,
  through the async context the consumer loop runs in; broker log lines now run outside any
  correlation context (`withoutCorrelationId`), so they carry none rather than a wrong one.
- The pre-commit hook of the second commit failed on both Kafka integration suites with "This
  server does not host this topic-partition", after three green full runs. kafkajs's
  `createTopics` with `waitForLeaders` asks for metadata before a fresh single node broker lists
  the topic and gives up. Fixed at the cause rather than retried (testing strategy: a flaky test
  is a defect): `KafkaService.ensureTopic` creates the topic without kafkajs's wait and polls the
  topic metadata until every partition has a leader.
- Left for `/ship`: README (start, mint a token, curl `PRG-1`), changelog, checklist, slice
  status. Left for `/spec` (noticed, not done here): the glossary has no entry for "dead
  letter" or for `rejected` as a message outcome, as the previous entry already observed.

## 2026-09-21, verify S-02, Fable
- VERIFY S-02: PASS on 95ed588. `npm run gate` green: unit 57, integration 18, e2e 23, cold
  start 3, smoke stack healthy in 37 s from a cached image. Coverage 10/10 AC and 1/1 INV, every
  tag on a test that ran and passed, no `.only`, `.skip` or `xit`, no trivially true body.
- Test levels match the plan: AC-20, AC-32, AC-33, AC-35 and AC-40 go through HTTP with
  supertest; AC-23, AC-24 and AC-25 publish over the real broker and read the store, the ledger
  and the dead-letter topic; AC-36 and AC-37 run the documented token command against the
  compose stack; INV-10 sweeps the Express router of the running application.
- Layer boundaries clean: no `@nestjs` import under `domain/`, no Prisma or kafkajs import
  under `domain/` or `application/`, no business word in `src/messaging/`. Diff scan for nested
  ternaries and braced one-line `if`s found nothing (one false positive on a `??` default with
  a URL). Prose check clean.
- Cold start by hand from a clean state with the README's own command: five containers healthy
  in 21 s (image cached), every URL the README lists answered 200, the availability endpoint
  answered 401 without a token and 200 with a dev token one second after boot, `docker compose
  down -v` left nothing behind. The expired-token case was not probed by hand (a shell quoting
  slip in the one-liner); the AC-33 e2e test covers it and passed in this run.
- Findings, none blocking: (minor) the README does not yet mention authentication, the dev token
  command or the availability endpoint; what it says still works as written, and README is
  `/ship`'s to update. (minor) `wiki/plan/plan.md` rows for S-02 still read `planned` with
  empty test file and commit columns, and the slice status is `in progress`; both are `/ship`'s.
  (note for `/review`) `api/src/tooling/` is a new app-level folder, as the implement entry
  already flags.

## 2026-09-21, review S-02, Fable (fresh context)
- REVIEW S-02: 6 findings (0/2/4). Not a pass: two majors. Diff reviewed: `6053ba4..HEAD` plus
  the working tree, against `CLAUDE.md §2 to §4`, the slice file, AC-20/23/24/25/32/33/35/36/37/40,
  INV-10, A-05/A-11/A-13/A-14/A-16/A-17/A-18 and ADR-0002/0003/0005/0006/0007.
- (major, spec) The consumer's rejection path trusts the shape it just refused: `messageId`,
  `programId` and `type` are read raw from a malformed payload with no length bound and written
  into `VARCHAR(128)`, `VARCHAR(64)` and `VARCHAR(32)` columns. A malformed message with an
  overlong id fails the insert, the transaction throws, the offset is never committed and the
  broker redelivers it forever: one bad message stalls the partition, which A-13 (4) and AC-25
  forbid. The same unbounded id becomes the correlation id of every log line and DLQ header.
- (major, spec) Words in code, API and storage with no glossary entry: `stale`, `rejected` and
  the message outcome set (`applied`, `duplicate`, `stale`, `rejected`), `dead letter`,
  `eventTime` / `limitEventTime`, `duplicateCount`. Route: `/spec`, since only Marcin adds
  glossary entries; the implement entry already flagged two of them.
- (minor) A message the use case recorded `rejected` is dead-lettered after the transaction
  committed; if that publish fails, the redelivery is answered `duplicate` and never
  dead-lettered, unlike the validation-failure path. (minor) The message DTO accepts a
  zone-less ISO 8601 time and reads it in the process's local zone while A-11 says UTC.
  (minor) The INV-10 sweep's method name table does not match Nest's `RequestMethod` enum at
  `ALL`, `OPTIONS`, `HEAD`; fails safe (spurious failure), never silently passes. (minor)
  `api/src/tooling/` is a new app-level folder: reason accepted (entry points, no business
  rule), the `CLAUDE.md §2` tree should list it.
- Concurrency note for the record: INV-10 has no critical section. For the consumer
  transaction, one program's messages share a partition and the handler is sequential; across
  a rebalance the same message could run twice, and then the `FOR UPDATE` row lock plus the
  primary key on `treasury_messages.message_id` make the second run a rollback and a redelivery
  that reads `duplicate`. Idempotency is guaranteed by the schema, not by luck.

## 2026-09-21, implement S-02 (review fixes, round 1), Fable
- Four of the six review findings fixed, each test first; the glossary finding is `/spec`'s and
  the `CLAUDE.md §2` tree entry for `api/src/tooling/` is `/ship`'s.
- (major) The rejection path no longer trusts the payload it refused. `readableString` in
  `readable-payload.ts` takes a bound equal to the column width (`message_id` 128,
  `program_id` 64, `type` 32) and answers null for anything longer, so an over-long id is
  "unreadable": the message is dead-lettered under a fresh correlation id, no row is written,
  and the offset commits. Contract test: an over-long `messageId` followed by a valid update;
  the valid one applies, the dead letter names `messageId`, the store has no row for it.
  Unit tests for the helper's bound and shapes.
- (minor) Both rejection paths now dead-letter first and record second, in one `reject()`.
  `ApplyCapacityUpdate` returns `rejected` on a currency mismatch without recording; the
  consumer records after the dead letter is out. If the publish fails, the redelivery repeats
  both steps; if the record fails, the dead letter goes out twice. At least once on the DLQ,
  which the previous order could not promise. Unit tests with a fake message source whose
  publish fails once, for both the use case path and the validation path.
- (minor) `eventTime` must carry `Z` or an offset (`@Matches` after `IsISO8601`), so the host
  zone never decides staleness (A-11, AC-24). DTO unit tests: offset read as the same instant,
  zone-less time and bare date refused, unknown field refused.
- (minor) The INV-10 sweep names methods with Nest's own `RequestMethod[method]` instead of a
  hand written table.
- Not changed, on purpose: the message store keeps `program_id` and `type` nullable, which is
  what makes recording a malformed message possible at all.

## 2026-09-21, verify S-02 (second pass, after review round 1), Fable
- VERIFY S-02: PASS on d9b15e7. `npm run gate` green: unit 67, integration 19, e2e 23, cold
  start 3, smoke stack healthy in 42 s with a rebuilt image. Coverage 10/10 AC and 1/1 INV, same
  files and levels as the first pass, no skipped or trivially true test.
- The four review findings routed to `/implement` are fixed at the source and each has a test
  that ran in this gate: ids are read only when they fit the store column (`readable-payload.ts`,
  applied to the correlation id as well), both rejection paths dead-letter before they record,
  `eventTime` must carry `Z` or an offset, and the INV-10 sweep names methods with Nest's
  `RequestMethod`. Layer boundaries clean; no nested ternary or braced one-line `if` in the
  fix commit; prose check clean.
- Cold start by hand from a clean state with the README's own command: five containers healthy
  in 20 s, every URL the README lists answered 200, the availability endpoint answered 401
  without a token and 200 with a dev token one second after boot, `docker compose down -v`
  left nothing behind. The expired-token probe by hand failed again on my side (the token
  script produced nothing, so the 401 was for an empty bearer); the AC-33 e2e test covers it.
- Findings, unchanged from the first pass and none blocking: (minor) the README does not yet
  mention authentication, the dev token command or the availability endpoint, `/ship`'s to
  update; (minor) plan rows and slice status still read `planned` and `in progress`, `/ship`'s.
  The glossary words from the review still await `/spec`.

## 2026-09-21, spec (glossary words after review round 1 of S-02), Fable
- Revision run, glossary only. Six words that code, storage and the message store already use
  had no entry, which the S-02 review found as a major: event time (`eventTime`,
  `limitEventTime`), message outcome (the set `applied`, `duplicate`, `stale`, `rejected`),
  stale, rejected, dead letter, duplicate count. Each now has an entry under Treasury messages
  written for a newcomer, with a number example where one helps.
- Marcin approved the wording as proposed and chose to fold the `duplicate` outcome into the
  existing Duplicate entry under Behaviour words rather than give it a second definition. That
  entry gained one sentence: the silence is recorded as the `duplicate` outcome and the first
  record's count goes up. The Message outcome entry points there.
- No acceptance criterion, invariant or assumption changed, so no Changes row: `CLAUDE.md §7`
  asks for one in those three files only, and the glossary has no Changes table, as the
  previous spec entry already noted. Entries define behaviour that ADR-0003, ADR-0007 and A-13
  had already decided; nothing new was decided here.
- Source of the requirement: the review entry of 2026-09-21 in this log, not a feature brief,
  so no file under `wiki/spec/features/` was created.

## 2026-09-21, review S-02 (second pass, after review fixes round 1), Fable (fresh context)
- REVIEW S-02: 6 findings (1/0/5). Not a pass: one blocker. Diff reviewed: `6053ba4..HEAD`
  (working tree clean), against `CLAUDE.md §2 to §4`, the slice file, AC-20/23/24/25/32/33/35/36/37/40,
  INV-10, A-05/A-11/A-13/A-14/A-16/A-17/A-18 and ADR-0002/0003/0005/0006/0007.
- Round 1 fixes hold: ids are read only when they fit the store column, both rejection paths
  dead-letter before they record, `eventTime` needs a zone, the INV-10 sweep uses Nest's
  `RequestMethod`, and the glossary now defines the outcome vocabulary.
- (blocker, spec) `availability.dto.ts`: `limit`, `reserved` and `available` are published as
  `type: number` in the OpenAPI document (checked by generating the schema from the DTO), while
  ADR-0006 fixes every DTO amount as `integer` in that document and `CLAUDE.md §2` makes the
  document the only contract with `web`. A client generated from the contract accepts fractional
  money. The wire values are integers; the contract does not say so.
- (minor) `domain/errors.ts` imports `src/common/errors/domain-error`, and the domain lint
  boundary does not restrict `**/common/**`, so the logger, guards and filters are importable from
  `domain/` today without a lint failure. (minor) `duplicate` is a storage enum value nothing
  writes and `findById` throws for that impossible row. (minor) `announce`/`announced` is a
  domain verb in code, an error message, the API description and test names with no glossary
  entry; route `/spec`. (minor) the message DTO repeats the column widths 128 and 64 as literals
  next to the named constants in `readable-payload.ts`. (minor) `CLAUDE.md §2` still does not
  list `api/src/tooling/` (round 1, routed to `/ship`, still open).
- Concurrency for the record: INV-10 has no critical section. The consumer's idempotency rests on
  the `treasury_messages` primary key and the `FOR UPDATE` row lock inside one transaction, as
  round 1 stated; nothing in this diff changes that.

## 2026-09-21, implement S-02 (review fixes, round 2), Fable
- Five of the six round 2 findings closed: the blocker and three minors here, the glossary
  minor through a one-entry `/spec` change in the same session (Marcin chose to add
  "Announce" rather than rename the code). The `CLAUDE.md §2` tree entry for
  `api/src/tooling/` stays with `/ship`.
- (blocker) The availability DTO now tells the OpenAPI document `type: 'integer'` for `limit`,
  `reserved` and `available` (ADR-0006). TypeScript has no integer type, so `@ApiProperty` on a
  `number` field said `number` and a client generated from the contract would have accepted
  fractional money. Test first: the docs e2e test reads `/openapi.json` and asserts the three
  properties are `integer`; it failed with `number` before the change.
- (minor) The domain lint boundary now covers `common/`: everything under it is restricted
  except `common/errors/`, the framework free error base the domain errors extend. Written as
  a regex (`(^|/)common/(?!errors/)`) because a negated glob in the same group was not honoured
  by the rule. Checked both ways with a throwaway file under `domain/` importing `JsonLogger`:
  one restricted-import error; then removed. `npm run lint` passes with the legitimate import.
- (minor) `duplicate` is no longer a storage enum value: it was never written, the glossary
  makes it a count on the first record, and the store's `findById` threw for a row that could
  not exist, which `§3` forbids. The Prisma enum, the port type and the migration lost the
  value, the throw is gone. The migration was edited in place rather than followed by a second
  one: S-02 has not merged, so no database outside a throwaway stack has applied it, and a
  slice branch is exactly where a migration may still change.
- (minor) Identifier widths live in one place, `domain/identifier-limits.ts`: the message DTO,
  the HTTP params DTO and the payload reader import them. The Prisma schema still carries the
  same numbers as literals because it cannot import; two places instead of four.
- Round 1 fixes untouched. `npm run gate:quick` result in the slice log row.

## 2026-09-21, verify S-02 (third pass, after review round 2), Fable
- VERIFY S-02: FAIL on 08274fb. Unit 67, integration 19 and e2e 24 green; the smoke stage failed
  at `docker compose up --wait`, which exited 1 with "container capacity-smoke-seed-1 exited
  (0)" while all five services were healthy. Reproduced three times from a clean state on the
  default project with a warm image: exit 1 every time. Docker Compose v2.39.1 counts a
  container that has already exited, even with code 0, as a failed wait. The earlier passes
  were timing: with a cold image the seed was still running when compose checked and showed as
  Healthy. A flaky cold start is a defect (testing strategy), and the README's one command
  returning non-zero is a finding against AC-36.
- Everything else holds: coverage 10/10 AC and 1/1 INV at the planned levels, no skipped test,
  layer boundaries clean including the new `common/` rule, no style drift in the two new
  commits, prose clean. Round 2 fixes confirmed: three `integer` money fields in the OpenAPI
  document (read back from the running stack), no stored `duplicate` outcome, widths from
  `domain/identifier-limits.ts`, `Announce` in the glossary. Cold start by hand: every README
  URL 200, availability 401 without a token, 200 with a dev token after one second, and 401
  with a genuinely expired token this time. Teardown clean.
- Finding, major, to `/implement`: the compose `seed` one-shot makes the documented start
  command exit non-zero once its image is warm. Fix candidates for that round: make another
  service depend on `seed` with `condition: service_completed_successfully` so compose knows
  the exit is the plan; or run the seed from the api entrypoint after the app is healthy so no
  container exits; or find the compose flag that accepts a clean exit. Whichever, `npm run
  smoke` must pass three times in a row on a warm image before the next verify.
- Findings unchanged and minor, for `/ship`: README says nothing about authentication or the
  dev token; plan rows and slice status still read `planned` and `in progress`;
  `api/src/tooling/` is not in the `CLAUDE.md §2` tree.

## 2026-09-21, implement S-02 (review fixes, round 3: the seed and compose --wait), Fable
- One finding, from the third verify: `docker compose up --wait` exited 1 with "seed exited
  (0)" once the image was warm, because Docker Compose v2.39.1 counts a container that has
  already exited as a failed wait unless something declares that exit as expected.
- Fix, one line of compose: `web` now depends on `seed` with
  `condition: service_completed_successfully`. That names the seed's clean exit as a condition
  compose understands, so `up --wait` reports it as Exited and moves on. Nothing else moved:
  the seed still runs from the api image after api is healthy, still sends the fixed
  `messageId`, and `web` already waited for api, so its start is not delayed in practice.
- Red and green measured the same way, `docker compose up --wait; echo $?` three times from a
  clean state on the default project with a warm image: 1, 1, 1 before; 0, 0, 0 after, in about
  twenty seconds each, with `PRG-1` readable through the availability endpoint afterwards.
  `npm run smoke` result three times in a row is in the slice log row.
- Considered and not taken: running the seed from the api entrypoint (no exiting container,
  but it puts a publisher next to the app, which the plan deliberately avoided) and a compose
  profile for the seed (one command would become two, against AC-36).
