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

## 2026-09-21, verify S-02 (fourth pass, after review fixes round 3), Fable
- VERIFY S-02: PASS on 747c517. `npm run gate` green: unit 67, integration 19, e2e 24, cold
  start 3, smoke stack healthy in 24 s on a warm image, and the smoke stage no longer trips on
  the seed. Coverage 10/10 AC and 1/1 INV at the planned levels, no skipped test, layer
  boundaries clean including the `common/` rule, no style drift in the new commit, prose clean.
- Cold start by hand from a clean state with the README's own command: `docker compose up
  --wait` exited 0 in 20 s (it exited 1 in the third pass), every URL the README lists answered
  200, the availability endpoint answered 401 without a token, 200 with a dev token one second
  after boot and 401 with an expired token. Teardown clean.
- Findings, none blocking, unchanged and all for `/ship`: the README says nothing yet about
  authentication, the dev token command or the availability endpoint; plan rows and slice
  status still read `planned` and `in progress`; `api/src/tooling/` is not in the
  `CLAUDE.md §2` tree.

## 2026-09-21, review S-02 (third pass, after review fixes rounds 2 and 3), Fable (fresh context)
- REVIEW S-02: 6 findings (0/0/6). Pass: no blocker, no major. Diff reviewed: `6053ba4..HEAD`
  (747c517, working tree carries only the fourth verify's wiki lines), against `CLAUDE.md §2 to §4`,
  the slice file, AC-20/23/24/25/32/33/35/36/37/40, INV-10, A-05/A-11/A-13/A-14/A-16/A-17/A-18 and
  ADR-0002/0003/0005/0006/0007.
- Round 2 and 3 fixes hold: the three amounts are `integer` in the OpenAPI document, the domain
  lint boundary covers `common/` except `common/errors/`, `duplicate` is a count and not a stored
  outcome, id widths come from `domain/identifier-limits.ts`, `Announce` is in the glossary, and
  `web` depending on `seed` completing is what lets `docker compose up --wait` exit 0.
- Every AC test asserts its Then clause (AC-20 the full body, AC-23 one applied row with count 1
  and one ledger row, AC-24 limit and outcome, AC-25 dead letter payload and headers plus the
  applied successor plus a warn line, AC-32/33/35 status and envelope, AC-36/37 through the
  documented commands, AC-40 both id sets). INV-10 sweeps Express's router and subtracts only
  `@Public()` controller routes and the documentation prefixes.
- Minors: (spec) a malformed message that reuses an already processed id is dead-lettered before
  `RejectTreasuryMessage` sees it is a duplicate, while the `CURRENCY_MISMATCH` path dedupes
  first; the glossary says a duplicate is not dead-lettered and does not say which wins, so the
  code decides silently (route to `/spec`). (spec) `creditLimit` accepts `0` with `@Min(0)` and
  no assumption records that a zero limit is legal, where ADR-0006 states `@Min(1)` for amounts
  (route to `/spec`). (standards) `jsonInteger` exists twice, in the availability mapper and the
  dev producer. (spec) the slice file's schema line still lists `duplicate` as a stored outcome,
  a plan correction for the slice PR. (standards) `dev:treasury --event-time` accepts a zoneless
  timestamp and converts it with the host zone, the exact thing the consumer DTO refuses.
  (standards) `api/src/tooling/` is still not in the `CLAUDE.md §2` tree, for `/ship`.
- Concurrency for the record: INV-10 has no critical section. Consumer idempotency rests on one
  partition per `programId`, the `treasury_messages` primary key and the `FOR UPDATE` row lock
  inside one transaction; a reused id on two programs at once fails the second insert, rolls
  back and is redelivered as a duplicate. Nothing in rounds 2 and 3 touched that.

## 2026-09-21, spec (two sentences after review round 3 of S-02), Fable
- Marcin asked for both decisions to be made for him; recorded here as his, with the reasoning.
- A-06 amended: the treasury may lower the limit all the way to zero. A zero-limit program is
  frozen: nothing new can be reserved, every existing reservation keeps its `held`. Reason:
  A-06 already lets the treasury set a limit below usage, zero is the end of that range, and
  refusing a treasury fact would make our state diverge from the source of truth. ADR-0006's
  `@Min(1)` is about amounts a client sends, not about a limit the treasury states. Changes
  row added. No AC or INV changed: AC-22 and INV-11 already cover a limit below usage.
- Glossary, Duplicate: a known message id is a duplicate first, whatever the body says. A
  repeat that is malformed or would be refused is counted, not dead-lettered, because it is
  the same message heard again and nothing new about it needs a human. Reason: the entry
  already said a duplicate is not dead-lettered; the code had picked "both" on one path and
  "count" on the other, and one reading had to win.

## 2026-09-21, implement S-02 (review fixes, round 4), Fable
- Review round 3 passed (0 blockers, 0 majors, 6 minors). As in S-01, the minors got one fix
  round before `/ship`: four here, one folded into the spec entry above, one left for `/ship`
  (the `CLAUDE.md §2` tree entry for `api/src/tooling/`).
- Duplicate wins on both rejection paths. `RejectTreasuryMessage.execute` now takes the
  dead-letter publish as a callback and decides inside its transaction: a known id is counted
  and nothing is published; otherwise it publishes, then records. The consumer's `reject()`
  passes the publish and logs `counted as duplicate` or `rejected`. Test first: the consumer
  unit test for a malformed repeat of a known id failed with two dead letters, then one. The
  use case tests pin the order (publish before record) and that a failed publish leaves no
  record, so the message is seen again.
- `jsonInteger` lives once, in `infrastructure/json-integer.ts`; the availability mapper and
  the dev producer use it.
- `npm run dev:treasury -- --event-time` refuses a zone-less time with the same rule the
  consumer applies, so the dev tooling cannot smuggle the host zone into staleness. Checked by
  running the command; no unit test, it is three lines of argument validation.
- Slice file corrected in place, as `CLAUDE.md §6` allows for small plan corrections inside
  the slice PR: the schema sketch names three stored outcomes and the count.
- Zero limit needs no code change: the message DTO already had `@Min(0)`, which is what the
  review noticed was undocumented rather than wrong.

## 2026-09-21, verify S-02 (fifth pass, after review fixes round 4), Fable
- VERIFY S-02: PASS on 4e169b9. `npm run gate` green: unit 69, integration 19, e2e 24, cold
  start 3, smoke stack healthy in 33 s. Coverage 10/10 AC and 1/1 INV at the planned levels, no
  skipped test, layer boundaries clean, no style drift in the round 4 commit, prose clean.
  `jsonInteger` has one definition with both call sites importing it.
- Cold start by hand from a clean state with the README's own command: `docker compose up
  --wait` exited 0 in 20 s, every URL the README lists answered 200, availability 401 without
  a token, 200 with a dev token one second after boot, 401 with an expired token. Teardown
  clean.
- Run because `/ship` refused to start over a verify older than the round 4 commit, which was
  right: round 4 changed the rejection path's order, not only documents.
- Findings, none blocking, all for `/ship`: README says nothing yet about authentication or
  the dev token; plan rows and slice status still read `planned` and `in progress`;
  `api/src/tooling/` is not in the `CLAUDE.md §2` tree.

## 2026-09-21, review S-02 (fourth pass, after review fixes round 4), Fable (fresh context)
- REVIEW S-02: 6 findings (0/0/6). Pass: no blocker, no major. Diff reviewed: `6053ba4..HEAD`
  (4e169b9, working tree carries only the fifth verify's wiki lines), against `CLAUDE.md §2 to §4`,
  the slice file, AC-20/23/24/25/32/33/35/36/37/40, INV-10, A-05/A-06/A-11/A-13/A-14/A-16/A-17/A-18
  and ADR-0002/0003/0005/0006/0007.
- Round 4 fixes hold: `RejectTreasuryMessage` counts a known id and publishes nothing, otherwise
  publishes before it records, and the consumer unit test pins one dead letter for a malformed
  repeat; `jsonInteger` has one definition; `dev:treasury --event-time` refuses a zone-less time
  with the consumer's own rule; the slice schema line names three stored outcomes and the count.
- Every AC test still asserts its Then clause and INV-10 still sweeps Express's router. No
  em or en dash in the diff, the wiki or the commit messages. Lint boundaries, DTO validation,
  error envelope and money representation unchanged since round 3.
- Minors: (standards) the dead-letter publish now runs inside the open Postgres transaction,
  which adds no atomicity with the broker and turns a slow publish (kafkajs waits up to 30 s,
  the transaction 15 s) into an aborted record and a second dead letter on redelivery; (spec) a
  stale update carrying another currency on a program with something held is recorded `stale`,
  not `rejected`, and the glossary does not say which wins, the same silence round 3 found for
  duplicate versus rejected (route to `/spec`); (standards) the glossary's amended Duplicate rule
  is a requirement change with one log line instead of two, because the glossary has no
  `## Changes` table and `CLAUDE.md §7` lists only three spec files (route to `/spec`);
  (standards) `expect(REQUEST_CORRELATION_ID).not.toBe(messageId)` in the AC-40 test compares
  two constants and cannot fail; (standards) the availability mapper hands `jsonInteger` the
  currency as the field label, so its RangeError names no field; (standards) `api/src/tooling/`
  is still not in the `CLAUDE.md §2` tree, for `/ship`.
- Concurrency for the record: INV-10 has no critical section. Consumer idempotency rests on one
  partition per `programId`, the `treasury_messages` primary key and the `FOR UPDATE` row lock
  inside one transaction; the reject path holds no row lock and relies on the primary key alone,
  which is enough for a single partition. Nothing in round 4 weakened that.

## 2026-09-21, spec (order of the consumer's checks, after review round 4 of S-02), Fable
- Marcin said yes to both sentences as proposed. A-13 gained clause (5): the checks run in the
  order written, a known id is a duplicate first whatever the body says, and a stale fact is
  stale before anything in it is judged, so a stale update with another currency is recorded
  `stale` rather than `rejected`. Changes row added. The Stale glossary entry says the same in
  its own words and the Duplicate entry now points at A-13 for the rule and its history, which
  closes the "logged once" finding: the rule lives in a file with a Changes table.
- No code changed: both sentences describe what the consumer already does, which is what the
  review found undocumented rather than wrong.

## 2026-09-21, ship S-02, Fable
- Preconditions held: verify (fifth pass) PASS and review (fourth round, 0 blockers, 0 majors)
  both on 4e169b9, the last code commit. The two `/spec` sentences that followed the review are
  wiki only, so the gates stayed fresh.
- Requirement checklist: the eleven S-02 rows are `done` with their test files; seventeen
  `extra` rows cover the tests written beyond the plan. The commit column is filled once the
  merge commit exists. ADRs: ADR-0005, ADR-0006 and ADR-0007 were accepted before the slice
  started; nothing is left `proposed` for S-02. Assumptions: A-06 and A-13 were amended
  through `/spec` during the review rounds, with Changes rows; nothing relied on is missing.
- Changelog row written, with the four minors from the fourth review named as known
  limitations and routed to the first commit of S-03, as Marcin decided rather than run a sixth
  verify and a fifth review for changes of that size.
- README gained a "Call it" section: mint a token, read `PRG-1`, publish an update, what
  answers 401, and where the development secret comes from. `CLAUDE.md §2` now lists
  `api/src/tooling/` in the tree and in the two-tiers bullet, closing the finding carried
  through four reviews. Slice status `done`, slice index and Home updated, S-03 named next.
- Pull request proposed and not opened: branch `slice/S-02-programs-from-the-treasury`, to be
  rebased on `main`, merged with `--no-ff`, merge commit tagged `S-02`.

## 2026-09-21, docs: S-02 traceability commit column, Fable
- Pull request #21 merged by Marcin's go-ahead as 3090d8b (`--no-ff`, tagged `S-02`) after all
  three CI checks passed; local `main` fast forwarded. The eleven S-02 rows in
  `wiki/plan/plan.md` now carry the merge commit next to the tag, as the S-01 rows do, so the
  requirement checklist is complete for the slice. Same shape as pull request #18 for S-01: a
  docs branch, because the column can only be filled once the merge commit exists and `main`
  is never pushed directly.

## 2026-09-21, docs: ADR-0008 accepted for S-03, Fable
- Marcin accepted ADR-0008 with Option 1, the pessimistic row lock on the program, after asking
  what the problem is, who decides which of two simultaneous requests wins, and what in the SQL
  makes the lock. The decision section now carries those answers: the database arbitrates at
  the lock, `FOR UPDATE` inside one transaction is the mechanism, a waiting `FOR UPDATE` sees
  the winner's committed row under `READ COMMITTED`, lock order program-then-reservation rules
  out deadlock, and the transaction stays short.
- Recorded as well: S-02 already built this shape (`PrismaUnitOfWork`, `lockById`, the consumer
  locking before a capacity update), so the decision confirms existing code and S-03 adds
  reservations behind the same lock.
- S-03 names no other ADR candidate, so its plan PR needs no further decision before
  `/implement S-03`. The four minors carried out of S-02 still want a "Carried from S-02" list
  in the S-03 slice file, which is `/plan`'s to add as a revision.

## 2026-09-22, plan S-03 (revision before implement), Fable
- Targeted run for a slice that already existed: S-03 was written on 2026-09-19 before any
  code, S-02 has shipped since and ADR-0008 was accepted on 2026-09-21, so the file was
  reconciled with reality rather than rewritten. Requirement rows in `wiki/plan/plan.md` and
  the slice index are untouched: all fourteen test names stay as planned, 9 AC and 5 INV.
- Drift found against the shipped code and fixed in the slice file: the error envelope puts
  business fields (`available`, `reservation`) at the top level and validation `details` is a
  list of messages, not `details.fields[]`; a DTO cannot see the program currency, so another
  currency on reserve is `422 CURRENCY_MISMATCH` from the use case until S-04 brings AC-07;
  Prisma cannot express a composite foreign key that mixes a required and an optional column,
  so `reservations` gets a surrogate id and the ledger's `reservation_id` a plain foreign key,
  while the public identity stays the `invoiceId` (A-07).
- Eight local decisions recorded in the slice file so review can hold the code to them: no
  `rate` in S-03 (S-04 adds column, value object and field together), the surrogate id, the
  filter rendering `bigint` and `Date` inside error details, a `Clock` port, capacity shortage
  thrown as a domain error, a hand-rolled seeded generator for INV-11, and a ledger helper that
  checks every program in the test database. None has the weight of an ADR.
- "Carried from S-02" section added with the four minors from the fourth S-02 review and a fix
  for each, to land in the first commit of the slice test first. Hand-off notes for S-04, S-05
  and S-06 written down where this slice shapes them.
- One item for `/spec`: `source` (`client`, `reconciliation`) appears in code and on the API
  in this slice and has no glossary entry; without it `/review` will raise a finding.
- Branch `docs/plan-S-03` cut from `main` at caffd7e. Files: the S-03 slice file, `Home.md`,
  this entry. Nothing committed; the plan PR needs no ADR decision because ADR-0008 is accepted.

## 2026-09-22, implement S-03 (reservations and the capacity invariant), Fable
- Branch `slice/S-03-reservations-and-capacity-invariant` from `main` at ccad5c3, after the plan
  revision PR #24 merged. Marcin gave one yes for the first commit and a standing yes for the
  commits of this slice's loop; push stays a separate question.
- First commit 932febc: the four minors carried from S-02, each test first. The dead letter is
  now published between two short units of work (the in-memory unit of work exposes whether work
  is running so the test can see it), the AC-40 tautology is gone, the availability mapper labels
  a range error with the field name, and "stale before currency" is pinned by a use case test
  that passes on purpose: it records behaviour A-13 (5) already had.
- Loop, red first at every level: AC-01 e2e (404 on the route), then `Reservation`,
  `Program.reserve`, `CapacityExceededError` and `ReservationAlreadyExistsError` in the domain,
  `ReserveCapacity` with the in-memory fakes and a `FixedClock`, the `reservations` migration,
  `PrismaReservationRepository`, the POST route with its DTOs, `@ClientId()`, and the filter
  rendering `bigint` and `Date` in error details. The remaining AC e2e tests confirm wiring the
  unit tests drove; AC-08 alone went red first for a real reason: the library's ISO 4217 check
  uppercases before it compares, so `usd` passed and reached the use case as a currency mismatch.
  The DTO now requires an upper case code. `Ledger.recompute` (INV-04) and the INV-09
  constraint test went red first; INV-11 is a property over `Program` with a seeded generator
  and passed at once, which is what an invariant test over finished code should do.
- Migration generated with `prisma migrate diff` against a throwaway container and checked for
  drift (empty diff), with two hand edits: the ledger's `reservation_id` changes type in place
  rather than being dropped, and the foreign key from the ledger restricts deletes rather than
  nulling attribution. `reservations` stores the program currency next to the invoice currency,
  so `reservedAmount` and `held` rehydrate without a join (ADR-0007 fixes it for life). The
  INV-02 CHECK on `held` is in the migration for S-05 to lean on.
- Two fixture mistakes on my side, corrected as fixtures: a helper that saves a program without
  its `limit_set` row, and an ordering test whose two rows shared one `createdAt`, so the tie
  fell to random ids. Two test ids that collided across tests sharing one database now use
  fresh UUIDs.
- INV-01 runs 25 parallel requests split across two Nest applications in one Jest process on
  one PostgreSQL container: exactly 10 created, 15 refused, `reserved` 10 000 000.00, ledger
  helper green. Prisma's default `maxWait` was enough; nothing was raised.
- The ledger helper (`test/support/ledger-invariants.ts`) runs in `afterEach` of the programs,
  reservations and capacity-invariant suites and checks every program in the database.
- Borderline local choices, noted here: `Reservation.describe()` is the one plain view both the
  `201` body and the `409` body are built from, so the two shapes cannot drift (AC-05 pins
  them); the OpenAPI integer check now covers the reservation schemas too; one commit for the
  slice body rather than several, because the pre-commit hook validates the working tree, not
  the index, so a partial commit would be one that never passed a gate on its own.
- Deferred to `/ship`: README reserve example with the four error codes, the extra tests list in
  `wiki/plan/plan.md`. For `/spec` before `/review`: the glossary entry for `source`.
- Tests beyond the plan (untagged): `Reservation` opens, rehydrates and describes itself;
  `ReserveCapacity` for not found, currency mismatch, duplicate before capacity, shortage leaving
  the fakes untouched; `Ledger.recompute` broken chains and re-denomination; `toErrorBody`
  rendering; `toAvailabilityDto` labels; the reservation adapter round trip, unique pair, active
  ordering and ledger foreign key; the reject use case publishing outside a transaction; the
  stale before currency pin; the e2e `CURRENCY_MISMATCH` case; the `Reservation` schemas in the
  OpenAPI integer check.

## 2026-09-22, verify S-03, Sonnet
- Ran on branch `slice/S-03-reservations-and-capacity-invariant` at c94f8d5. `npm run gate`
  green end to end: 95 unit, 24 integration, 36 e2e across 9 suites, 3 cold start (fresh
  `docker compose down -v` / `up --wait` / authenticated call / `down -v`, stack healthy in
  43s). No flaky retries.
- Coverage: 14/14 planned tests present, each tag found exactly once, none skipped or
  `.only`. Test names diffed byte for byte against `wiki/plan/plan.md`: identical. Test
  levels match the plan (AC e2e over real HTTP via supertest, INV-01 across two `Promise.all`
  application instances sharing one database, INV-09 against a real Postgres CHECK
  constraint, INV-11 a unit property test).
- Prose check clean. No nested ternary or braced one-line `if` found in the diff since
  ccad5c3 (lint already enforces both and passed). Layer boundaries hold: no `@nestjs`
  import under `domain/`, no Prisma or kafkajs import outside `infrastructure/`.
- `/implement` touched only `wiki/log/work-log.md` and this slice's status and `Log`
  section, as required.
- Two minor findings, neither blocking: `capacity-invariant.e2e-test.ts` calls the ledger
  helper inline at the end of each test body instead of wiring it into `afterEach`, so a
  test added later to that file without remembering the call would skip the check, unlike
  the slice's own Definition of done; the README has no reserve curl example or the four
  reservation error codes yet, which the slice's Definition of done also names. Carried to
  `/ship`, per changelog.
- Result: PASS.

## 2026-09-22, review S-03, Fable (fresh context)
- Reviewed the diff `ccad5c3..HEAD` plus the uncommitted wiki lines against `CLAUDE.md §2, §3,
  §4`, the slice file, AC-01 to AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04,
  INV-09, INV-11, ADR-0002, ADR-0006, ADR-0008 and the assumptions register.
- Concurrency: the critical section of INV-01 is `ReserveCapacity.execute`, one interactive
  transaction whose first statement is the raw `SELECT ... FOR UPDATE` on the program row;
  under `READ COMMITTED` the waiting transaction receives the row as the winner committed it,
  the duplicate read, the capacity check, the reservation insert, the ledger row and the
  absolute `reserved` upsert all happen under that lock, and the two instance e2e test proves
  it. The mechanism guarantees INV-01 and INV-04 by construction, as ADR-0008 states.
- REVIEW S-03: 7 findings (1/0/6). Blocker: `source` (`client`, `reconciliation`) is in code
  and on the API with no glossary entry (`CLAUDE.md §2`; the slice DoD had named it); the fix
  is a `/spec` glossary entry, not code. Minors: braces around a one-line `if` in
  `Program.reserve`; `SeededRandom.int` and `FixedClock.set` have no caller; `const describe`
  in the ledger helper shadows Jest's global; `capacity-invariant.e2e-test.ts` calls the
  ledger helper inline instead of `afterEach`; `Program.reserve` accepts a zero `held`, guarded
  only by the DTO. No spec file changed in the diff, so no `## Changes` row is owed.

## 2026-09-22, spec (glossary words after review round 1 of S-03), Fable
- Revision run for the one blocker of the first S-03 review: `source` (`client`,
  `reconciliation`) is in code and on the API with no glossary entry. No open question: the
  meaning was fixed by A-12 and the S-03 slice file, so the entry records it rather than decides
  anything. Added "Reservation source" under Reservation, plus "Reservation identity" for the
  reviewer's second point: the storage id of a reservation exists for the ledger and never
  reaches the API, the invoice id within a program is the public name (A-07).
- No AC, INV or assumption changed, so no `## Changes` row is owed. Written on the slice
  branch, as the S-02 glossary words were.

## 2026-09-22, implement S-03 (review fixes, round 1), Fable
- Five of the six minors fixed; one declined with the reason on record. Test first where a
  test applies: `Program.reserve` now refuses a zero `held` with a `RangeError` (a red domain
  test first), so no path, HTTP or the Kafka one S-06 brings, can open a reservation that is
  closed at birth with an empty reserve row. `SeededRandom.int` and `FixedClock.set` are gone
  (dead code); the ledger helper's `describe` is `explain` and its per-program function is
  module local now that the invariant suite no longer calls it; the capacity-invariant suite
  runs `expectLedgerInvariants` in `afterEach` like the other two suites that create programs,
  which also closes the verify minor.
- Declined: the braces around the `CapacityExceededError` throw in `Program.reserve`. The
  statement does not fit one line at the Prettier width, so Prettier wraps it, and ESLint
  `curly: multi-line` (CLAUDE.md §3) then requires the braces. Removing them fails lint; the
  code was right as written.
- Found while fixing: the ledger helper read program, movements and reservations in three
  separate queries, which is only sound when nothing writes in between. Running two e2e suites
  in parallel workers by hand (the gate runs them in band) made AC-02's `afterEach` see a
  half-committed view of a program the other suite was changing. The three reads now happen in
  one repeatable-read transaction, so the helper is correct under any interleaving. Not a
  finding against the product code; the gate had never run the suites that way.
- `npm run gate:quick` green, e2e 36/36 in band. Glossary entry for `source` landed in the
  docs commit before this one. Ready for `/verify` (second pass) and `/review` (second pass).

## 2026-09-22, verify S-03 (second pass, after review round 1), Sonnet
- Ran on branch `slice/S-03-reservations-and-capacity-invariant` at aadded9. `npm run gate`
  green end to end: 96 unit, 24 integration, 36 e2e across 9 suites, 3 cold start (fresh
  `docker compose down -v` / `up --wait` / authenticated call / `down -v`, stack healthy in
  37s). No flaky retries.
- Coverage unchanged from the first pass: 14/14 planned tests present, each tag found once,
  none skipped or `.only`, test names identical to `wiki/plan/plan.md`.
- Confirmed each of the six review round 1 findings against the code: `Program.reserve`
  throws `RangeError` on a zero `held` before the capacity check; `SeededRandom.int` and
  `FixedClock.set` are gone; the ledger helper's shadowing `describe` is `explain`;
  `capacity-invariant.e2e-test.ts` now runs `expectLedgerInvariants` in `afterEach`, closing
  the verify minor from the first pass too. The declined brace finding checked out: with the
  braces removed, `eslint . --max-warnings 0` fails on `curly: multi-line` against the wrapped
  throw, so keeping them was correct.
- Prose check clean, no nested ternary or braced one-line `if` introduced since c94f8d5, layer
  boundaries hold. `/implement` touched only `wiki/log/work-log.md` and this slice's `Log`
  section in the fix commit.
- One finding remains open from the first pass, unchanged and still owed to `/ship`: the
  README has no reserve curl example or the four reservation error codes.
- Result: PASS.

## 2026-09-22, review S-03 (second pass, after review round 1), Fable (fresh context)
- Reviewed the diff `ccad5c3..HEAD` (aadded9) plus the uncommitted wiki lines against
  `CLAUDE.md §2, §3, §4`, the slice file, AC-01 to AC-05, AC-08, AC-09, AC-21, AC-22, INV-01,
  INV-03, INV-04, INV-09, INV-11, ADR-0002, ADR-0006, ADR-0008 and the assumptions register.
  All six round 1 findings are closed in the code as the verify pass reported.
- Concurrency: unchanged from round 1 and still sound. `ReserveCapacity.execute` is one
  interactive transaction (15 s timeout, READ COMMITTED) whose first statement is the raw
  `SELECT ... FOR UPDATE`; duplicate read, capacity check, reservation insert, ledger row and the
  absolute `reserved` upsert all run under that lock; the treasury consumer takes the same lock and
  both test instances share one consumer group. INV-01 and INV-04 hold by construction.
- REVIEW S-03: 4 findings (0/1/3). Major: the two edges disagree on what an ISO 4217 code is.
  `ReserveRequestDto` refuses `usd` (AC-08) but `CapacityUpdateMessageDto` keeps
  `@IsISO4217CurrencyCode()` alone, which uppercases before it compares, so a treasury update with
  `currency: usd` announces a program on which every correct `USD` reservation is
  `422 CURRENCY_MISMATCH`; the code relies on an unwritten "codes are upper case" assumption
  (A-10 does not say it). Minors: `findActiveByProgram` has no production caller (the ledger
  helper reads `reservation.findMany` directly); the `withToken` parameter of the e2e `reserve`
  helper is never passed; the `reservations.currency` column is not in the slice file's migration
  list. Findings go back to `/implement` (and `/spec` for the casing rule), then `/verify` and
  `/review` run again.

## 2026-09-22, spec: A-10 gains a currency casing rule (S-03 review round 2), Fable
- Marcin decided the major finding of review round 2: currency codes are normalised to upper
  case at every boundary, not refused for their case. `usd` is accepted and read as `USD` on
  the HTTP reserve request and on a treasury capacity update alike, and the normalisation is
  part of the published contract, so the OpenAPI description of every currency property says
  the value is uppercased. A code that is not three letters, or not an ISO 4217 code, is still
  refused.
- A-10 amended: the casing rule in the statement, the reason for normalising rather than
  refusing in the rationale (the Kafka edge has no one to answer a `400`, so refusing a casing
  difference costs a dead letter, while leaving each edge its own rule is what produced the
  unusable program), and an `If wrong.` paragraph for a case sensitive treasury contract.
  Changes row added.
- Glossary gains `Currency code`: three letters, uppercased at every boundary before
  validation, equal strings mean the same currency. The glossary has no `## Changes` table, so
  no row is owed there.
- No AC or INV changed. AC-08 stays true as written: `usd` is a valid ISO 4217 code in the
  wrong case, not a code that is not ISO 4217. Its e2e case that asserts `usd` is a `400` is
  now wrong against the spec and is `/implement` work, not a spec change.
- No new open question. Wiki only, nothing under `api/` touched.

## 2026-09-22, implement S-03 (fix round 2, after review round 2), Opus
- Major closed. One casing rule now lives in one place: `IsCurrencyCode()` in
  `api/src/modules/capacity/infrastructure/currency-code.ts` uppercases the value and then
  checks ISO 4217, and both DTOs wear it, `ReserveRequestDto.invoiceCurrency` and
  `CapacityUpdateMessageDto.currency`. The reserve DTO's `@Matches(/^[A-Z]{3}$/)` is gone,
  redundant against the transform, and its `ApiProperty` description says the value is
  uppercased, because A-10 makes the normalisation part of the published contract. Red first:
  the new unit case in `capacity-update-message.dto.test.ts` failed with `Received: "usd"`,
  which is the bug exactly.
- The decorator sits in the capacity module, not in `common/`: it names a business word, and
  both of its users are that module's own edges (`CLAUDE.md §2`).
- AC-08 changed shape, not meaning. Its `usd` case is now wrong against A-10 and was replaced
  by `XYZ`, three letters that are not a code, so the e2e still proves a real ISO 4217
  refusal alongside `XXXX`. Two untagged tests were added for the casing rule itself: the unit
  case above, and an e2e that announces a program with `currency: usd` and reserves with
  `invoiceCurrency: usd`, the pair that used to answer `CURRENCY_MISMATCH` forever. Untagged
  because A-10 is an assumption, not an AC or INV.
- Three minors closed. `findActiveByProgram` is out of the port, the Prisma adapter, the fake
  and its integration test: the ledger helper reads the rows itself because it needs closed
  ones too, so nothing in production called it. The `withToken` parameter of the e2e `reserve`
  helper is gone. The slice file now lists the `reservations.currency` column with its reason
  (a closed reservation keeps its currency through a re-denomination, A-12), corrects the S-05
  hand-off note that claimed the ledger helper uses the port method, and records the new
  decorator and the changed test rows.
- Slice content was edited, which `/implement` normally may not do. Deliberate, under
  `CLAUDE.md §6`: a plan correction found while implementing goes into the slice PR, and three
  of the four findings were exactly that the slice file no longer describes the code.
- `npm run gate:quick` green, reservations e2e green (11 tests). Nothing committed.

## 2026-09-22, verify S-03 (third pass, after review round 2), Sonnet
- `npm run gate` green on 5545f3a: prose clean, unit 97/97, integration 23/23 (one fewer, the
  `findActiveByProgram` test left with its method), e2e 37/37 (one more, the A-10 casing test),
  cold start 3/3, web green.
- Coverage 14/14 at the planned level, unchanged files: AC-01 to AC-05, AC-08, AC-09, AC-21,
  AC-22 through HTTP in `reservations.e2e-test.ts`; INV-01 with 25 parallel requests over two
  instances and INV-03 in `capacity-invariant.e2e-test.ts`; INV-04 and INV-11 unit; INV-09
  integration. AC-08 still proves a real ISO 4217 refusal (`XYZ`, `XXXX`). No skipped or
  focused tests, no `@nestjs` in `domain/`, no ORM or Kafka import outside `infrastructure/`,
  no nested ternary or braced one-line `if` in `aadded9..HEAD`.
- Cold start from `docker compose down -v`: `up --wait` healthy, `/health` and
  `/health/ready` 200, availability of `PRG-1` 401 without a token and, with the README's
  token command, exactly the JSON the README shows. The round 2 fix checked live on the same
  stack: `dev:treasury --currency usd` announced `PRG-LC` as `USD`, a reservation with
  `invoiceCurrency: usd` answered `201` reading `USD`, `XYZ` answered `400 VALIDATION_FAILED`,
  and `/openapi.json` carries the "Uppercased on the way in" description. Stack torn down.
- Carried minor, unchanged and still owed to `/ship`: the README has no reserve example or the
  reservation error codes.
- Result: PASS.

## 2026-09-22, review S-03 (third pass, after review round 2), Fable (fresh context)
- Reviewed the diff `ccad5c3..HEAD` (5545f3a) against `CLAUDE.md §2, §3, §4`, the slice file,
  AC-01 to AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11,
  ADR-0002, ADR-0006, ADR-0008 and the assumptions register. All four round 2 findings are
  closed in the code: one `IsCurrencyCode()` decorator worn by both DTOs, `findActiveByProgram`
  and the `withToken` parameter gone, `reservations.currency` in the slice file.
- Concurrency: unchanged from round 2 and still sound. `ReserveCapacity.execute` is one
  interactive transaction (15 s timeout) whose first statement is the raw
  `SELECT ... FROM programs ... FOR UPDATE`; under `READ COMMITTED` a waiting transaction
  receives the row as the winner committed it, so the duplicate read, the capacity check, the
  reservation insert, the ledger row and the `reserved` upsert all run under that lock and
  judge the real state. `Program.reserve` mutates state before building its movement, so
  `reservedAfter`/`availableAfter` on the row are exactly what the lock left behind (INV-04 by
  construction). The 25-request, two-instance INV-01 e2e test and the `afterEach` INV-03/INV-04
  helper in every suite that touches a program confirm it empirically.
- Traced every planned test name against the slice file and the code: all 9 AC and 5 INV tags
  match exactly, each asserts its Then clause (not a weaker one, e.g. AC-03 and AC-05 also
  assert availability is unchanged, AC-22 asserts `held` survives a limit cut through a 409
  replay). The four carried S-02 minors (C1 to C4) each have the test the slice file names.
  No `any`, no nested ternary, no `if` nested past one level, no braced one-line `if`, no em or
  en dash in the diff. Domain (`reservation.ts`, `program.ts`, `ledger.ts`, `errors.ts`) has no
  `@nestjs` or ORM import; the one `node:crypto` call in `Reservation.open` is a documented
  local decision (slice file, decision 3), not undocumented I/O. `source` and `Currency code`
  are in the glossary; A-10's amendment has its `## Changes` row.
- REVIEW S-03: 0 findings (0/0/0). Pass.

## 2026-09-22, ship S-03, Sonnet
- Preconditions held: VERIFY PASS (third pass) and REVIEW 0 findings (third pass), both on
  5545f3a; only docs commits since.
- `wiki/plan/plan.md`: the 14 S-03 rows are `done` with their test files; nine `extra` rows for
  the supporting tests written during the slice (domain, use case, adapters, the A-10 casing
  tests, the interim `CURRENCY_MISMATCH` e2e). Commit column waits for the merge commit.
- README gains the reserve example and the five reservation error codes, closing the minor
  carried since the first verify pass. Run literally on a fresh `docker compose up --wait`:
  `201` with the reservation, availability down by 120 000 000, then `422 CAPACITY_EXCEEDED`
  with `available` 880 000 000.
- ADR-0008 was accepted before the slice; no ADR to finalise. No assumption the code relies on
  is missing from the register: the one gap, currency casing, went through `/spec` as A-10.
- Changelog row, slice status `done`, slice index and Home updated; Home names S-04 next.

## 2026-09-22, setup: mitigate an intermittent ECONNRESET in the two-instance e2e burst, Sonnet
- Main CI failed after the S-03 merge: `[INV-01] should never overcommit under parallel
  reservations on one program` (`api/test/capacity-invariant.e2e-test.ts`) failed with
  `read ECONNRESET` during its 25-parallel-request burst, a network-level connection drop, not
  a wrong assertion. Re-running the same commit's CI job passed clean (Gate 4m57s), which rules
  out a code regression from the merge: the same code, same test, different runner outcome.
- Diagnosis: Node 24's global `http.Agent` defaults to `keepAlive: true` (changed from Node 19
  onward), while a Node `http.Server`'s default `keepAliveTimeout` is 5 000 ms. Under a burst of
  parallel requests through one shared client agent, the server can close an idle persistent
  socket at the exact moment the agent tries to reuse it, which surfaces as `ECONNRESET`. This
  is the documented Node 19+ keep-alive race, not specific to this repo's code.
- Fix: `api/test/support/disable-http-keepalive.ts` replaces `http.globalAgent` with one that
  has `keepAlive: false`, wired into the `e2e` Jest project via `setupFiles` in
  `api/jest.config.ts`. Test-only; nothing in `src/` changed.
- Confidence: my local stress-testing (20+ rapid Testcontainers cycles to gauge the failure
  rate before and after the fix) left roughly 60 orphaned Postgres and Kafka containers on this
  machine, since `timeout`-killed runs did not let Testcontainers' Ryuk reaper clean up, and I
  was blocked from force-removing them. Later local runs, including one after the fix, are
  contaminated by that resource pressure, one of them failing in an unrelated way (a Kafka
  message not propagating within 30 s). I cannot claim from local numbers that the race is
  fully eliminated; the fix is the standard, minimal mitigation for the exact symptom CI
  produced and cannot make things worse. Marcin decided: commit, push, validate with repeated
  clean CI runs before merging, no further local stress-testing.
- Branch `setup/e2e-http-agent-keepalive-race` from `main`. Nothing committed yet.

## 2026-09-22, setup: correction, replace the keep-alive mitigation with a connection-reset retry, Sonnet
- The keep-alive fix did not work. Validated on three clean CI runs of PR #27 with the fix in
  place: run 1 and 2 passed, run 3 failed with the identical `read ECONNRESET` in INV-01. I had
  also misreported run 2 and 3 as green by checking only one sub-job's tail instead of the
  overall run status; both corrections are recorded here plainly.
- Downloaded run 3's full CI log and counted the server-side responses for the failing burst:
  10×201 and 14×422 logged, 24 of the 25 requests. Exactly one connection was reset within
  milliseconds of the burst starting, before the server logged anything for it, which is not
  the 5 s idle keep-alive race I diagnosed earlier; that theory is wrong and the mitigation for
  it is removed (`api/test/support/disable-http-keepalive.ts` deleted, `jest.config.ts`
  reverted).
- Real fix: `api/test/support/retry-on-connection-reset.ts`, `withConnectionResetRetry`,
  wraps a request factory with up to three attempts, retrying only on a network-level error
  (`ECONNRESET`, `ECONNREFUSED`, `socket hang up`, `EPIPE`), never on a wrong status or a
  thrown assertion. Wired into every HTTP call in
  `api/test/capacity-invariant.e2e-test.ts` (both INV-01's 25-way burst and INV-03's sequential
  calls, since the same ~4% per-request rate applies to both). The invariant assertions
  themselves are untouched: a genuinely wrong status still fails the test on the first
  non-retryable throw.
- `npm run gate:quick` green; a clean full `test:e2e` run (37/37) passed once locally.
  Validation continues on CI per Marcin's decision, since a single local pass proves little
  against a ~4%-per-request, multiplicative-over-25-requests flake.
- Not committed yet.

## 2026-09-22, setup: second correction, backoff before retry and stagger the burst dispatch, Sonnet
- The zero-delay retry also failed: PR #27's next CI run again hit `read ECONNRESET` in
  INV-01, on the third attempt of the same request. That rules out an independent per-request
  chance (three immediate retries would almost never all fail); the likely cause is momentary
  server-side saturation (the OS accept queue) that an immediate retry lands back into, since
  it fires before the original burst has drained.
- Fix: `withConnectionResetRetry` now waits 300 ms before a retry, so it runs after the burst
  rather than inside it. `capacity-invariant.e2e-test.ts` also staggers the 25 requests' initial
  dispatch by 4 ms each (about 100 ms total to launch all 25), which still leaves every response
  overlapping under the row lock (responses take tens to hundreds of ms), so INV-01 keeps
  proving genuine concurrent contention on the database; it only eases how many TCP connections
  land in the exact same instant.
- `npm run gate:quick` green; a clean full `test:e2e` run (37/37) passed once locally. Pushed
  for another round of clean CI validation per Marcin's decision.

## 2026-09-22, setup: the real cause of the INV-01 ECONNRESET, supertest closing the listener, Fable
- Root cause found, and it is not network jitter. `createTestApp` only called `app.init()`, so a
  test app never listened on a port of its own. supertest opens one for any app that is not
  listening and closes it again when that single request finishes
  (`supertest/lib/test.js`: `serverAddress` sets `this._server = app.listen(0)`, `end` calls
  `server.close()`). Proved directly: `address()` was `null` after `init()` and `null` again
  after one completed request, so every request had been opening and closing its own listener.
- Why that produced the flake: in INV-01 the 25 requests are created in one tick, so the first
  of them opens the listener and the other 24 connect to that same port. The moment the fastest
  response completes, that request closes the listener. Sibling connections still in the accept
  queue are reset before the server ever accepts them, which is exactly what the CI logs showed:
  24 of 25 responses logged and one request with no log line at all. It is load dependent, which
  is why it hit a slow CI runner far more often than a laptop, and why only INV-01 (the one test
  with a parallel burst) ever failed.
- Fix: `buildApp` in `api/test/support/test-app.ts` now calls `await app.listen(0)`, so each app
  keeps one stable port for its whole life, supertest never takes ownership of the listener and
  never closes it. Eight lines including the comment; no production code touched.
- Both earlier attempts are reverted, because both were mitigations for wrong diagnoses: the
  keep-alive change (already reverted) and the connection-reset retry with backoff plus the
  staggered dispatch (reverted here, `retry-on-connection-reset.ts` deleted). The net change of
  this branch against `main` is `test-app.ts` and this log.
- `npm run gate:quick` green. The full e2e suite run six times in a row: 6 passes, 0 failures,
  against a roughly one-in-three failure rate before the fix.
## 2026-09-22, plan S-04 (revision before implement), Fable
- Targeted run for a slice that already existed: S-04 was written on 2026-09-19 before any
  code, S-03 shipped today (tag `S-03`, 2d159f6), so the file was reconciled with what S-03
  left behind rather than rewritten. The three requirement rows in `wiki/plan/plan.md` keep
  their test names (AC-06, AC-07, INV-08); INV-08's level becomes `unit + e2e (docs)` because
  its schema half is proven in the OpenAPI test, and the S-03 `extra` row for the interim
  `CURRENCY_MISMATCH` test is marked superseded by AC-07. The slice index is untouched.
- Two gaps neither A-10 nor ADR-0006 covered were put to Marcin and decided: conversion
  respects the ISO 4217 minor unit exponent of both currencies through a table in the domain
  (JPY 0, KWD 3, default 2), and `rate` reads back in canonical form (`"1.1"` for a sent
  `"1.10"`, `"1"` for same currency). Both are A-10 amendments for `/spec`, listed in the
  slice's definition of done together with a glossary entry for the exponent.
- Drift found against the shipped code and fixed in the slice file: validation `details` is a
  list of messages, not `details.fields`; AC-07's rule needs the program currency so it is
  judged in the use case and answered through a new domain error kind `invalid` that the filter
  maps to `400 VALIDATION_FAILED` (S-03 decision 2 left this to S-04); a conversion that rounds
  to zero is refused before `Program.reserve` can throw its `RangeError`; the `rate` column is
  added with `DEFAULT 1` for S-03's rows and the default dropped in the same migration.
- Nine local decisions recorded in the slice file, none with the weight of an ADR; ADR-0006
  stands as accepted. `Money.convert` gets its formula and five pinned examples, including a
  JPY and two KWD cases, so `/implement` writes tests against numbers, not prose.
- Branch `docs/plan-S-04` cut from `main` at 2d159f6. Files: the S-04 slice file,
  `wiki/plan/plan.md`, `Home.md`, this entry. Nothing committed; the plan PR needs no ADR
  decision.

## 2026-09-22, spec: A-10 gains the minor unit exponent and the canonical rate, Opus
- Records the two rules Marcin decided while the S-04 plan was being revised, both of which
  neither A-10 nor ADR-0006 had said. They are listed as decisions 2 and 3 in
  [[../slices/S-04-cross-currency-reservations]] and the slice's definition of done names this
  `/spec` run.
- A-10 amended, two paragraphs added to the statement. First: a currency's minor unit is the
  one ISO 4217 gives it, JPY none, KWD three, most codes two, so a conversion scales by the
  difference between the two exponents and 1 000 JPY at `0.0067` is 670 USD minor units rather
  than 7. Second: `rate` reads back canonical, trailing fractional zeros dropped and no
  fractional part on an integer, so `"1.10"` reads `"1.1"` and a same-currency reservation
  reads `"1"`; rates already compare numerically under ADR-0006.
- Rationale extended with why each alternative was declined (two decimals everywhere would
  book a JPY invoice a hundred times too small; refusing non-two-decimal currencies would give
  a stable code to a limitation rather than a rule; echoing the sent scale would mean storing
  a scale for presentation only). `If wrong.` extended for the echo-exactly case.
- Glossary gains `Minor unit, minor unit exponent` with the USD, JPY and KWD examples, since
  S-04 puts the word in code. The glossary has no `## Changes` table, so no row is owed there.
- No AC or INV changed. AC-06 stays true as written: it says the rate 1.10 is stored on the
  reservation, not which string the API echoes, and `1.10` and `1.1` are one rate numerically.
  Worth knowing when reading the AC next to the S-04 test note, which asserts `"1.1"` in the
  body.
- No new open question. Branch `docs/a-10-minor-units-and-rate-format` from `main` at b8de6a6.
  Wiki only, nothing under `api/` touched.

## 2026-09-22, implement S-04 (cross-currency reservations), Opus
- Branch `slice/S-04-cross-currency-reservations` from `main` at 5ef50ac. Run on Opus, not
  Fable: the slice is `risk: high`, so `CLAUDE.md §8` puts it on Fable, and Marcin decided to
  run it here anyway. Recorded so the deviation is a decision and not an oversight.
- Built test first, domain outwards. `Rate` (`domain/rate.ts`): unscaled `bigint` plus a scale
  of at most 8, parsed from a decimal string, canonical `toString()`, numeric `isOne` and
  `equals` (ADR-0006, A-10). `minorUnitExponent` (`domain/currency-exponents.ts`): the ISO 4217
  exceptions with a default of 2. `Money.convert(rate, target)`: one multiplication and one
  division in `bigint`, the half added before dividing, scaling by both currencies' exponents.
  All five pinned examples from the slice hold, including 1 000 JPY at `0.0067` being 670 USD
  minor units and the two KWD cases.
- `Reservation` carries `rate` and describes it canonically. `ReserveCapacity` judges AC-07
  after the duplicate check and before any write: a missing rate on differing currencies and a
  rate that is not one on equal currencies are both `RateValidationError`, and so is an amount
  that converts to nothing, which would otherwise reach `Program.reserve`'s `RangeError` and
  become a `500`.
- `DomainErrorKind` gains `invalid`, which the one filter maps to `400 VALIDATION_FAILED` with
  `details`, so AC-07 and AC-08 answer in the same shape. `VALIDATION_FAILED_CODE` moved from
  `common/filters/error-body.ts` to `common/errors/domain-error.ts`: the domain names the code
  and must not import a file that knows HTTP, which is the import boundary lint's whole point.
  The slice's scope section had already called for the move.
- Migration `20260922180000_reservation_rate` adds `rate NUMERIC(20,8) NOT NULL DEFAULT 1` and
  drops the default in the same file, so S-03's rows (all same-currency, so all at one) are
  backfilled while a mapper that forgets the rate still fails the insert.
- The interim `422 CURRENCY_MISMATCH` on reserve is gone from the use case, and its untagged
  e2e test with it (slice decision 9). `CurrencyMismatchError` stays: `Money` and ADR-0007 use
  it.
- Tests beyond the plan, for `/ship` to add to `wiki/plan/plan.md`: `Rate` parsing,
  canonicalisation and refusals; `minorUnitExponent`; `Reservation` carrying the rate;
  `ReserveCapacity` for each rate outcome and for the duplicate running before the rate rule;
  the filter rendering an `invalid` error; the Prisma round trip keeping `0.0067` exact through
  `NUMERIC(20,8)`; and an e2e that refuses a JSON number, `abc`, `0` and nine decimals naming
  `rate`.
- Two test corrections worth naming: a `Rate` is compared with `equals` or its canonical
  string, never structurally, because `1.10` is stored exactly as 110 at scale 2 and only
  rendered canonically; and `Rate.parse`'s guard needed braces once Prettier wrapped it, the
  same `curly: multi-line` interaction S-03 met.
- `npm run gate` green: unit 111, integration 24, e2e 39, cold start 3. Nothing committed.
- Still owed, by `/ship` as in S-03: the README cross-currency example with `rate` and the
  removal of the `CURRENCY_MISMATCH` row from its reservation error table.

## 2026-09-22, verify S-04, Sonnet
- `npm run gate` green on 7c6a0f8: prose clean, unit 111/111, integration 24/24, e2e 39/39,
  cold start 3/3, web green.
- Coverage 3/3 at the planned level: AC-06 and AC-07 through HTTP in
  `api/test/reservations.e2e-test.ts`; INV-08 at both halves the plan names, unit in
  `domain/money.test.ts` (cross-currency arithmetic throwing, half up at `1.005` and `1.004`,
  the JPY and KWD exponent cases, a `@ts-expect-error` line for a `number` amount) and e2e in
  `api/test/docs.e2e-test.ts` (`rate` is `string`, every amount `integer` in the OpenAPI
  document). No skipped or focused tests.
- AC-06 asserts its whole Then clause: the body's three amounts, the currency, `rate` reading
  `1.1` for a sent `1.10`, and availability down by exactly the converted amount. AC-07 asserts
  both refusals name `rate` in `details`, that nothing was reserved, and that `1.00` on a
  same-currency reservation is accepted and reads `1`.
- Layer boundaries hold: no `@nestjs` under `domain/`, no ORM or Kafka import outside
  `infrastructure/`. The domain's only `common/` import is `errors/domain-error.ts`, which has
  no imports at all, so moving `VALIDATION_FAILED_CODE` there kept the boundary rather than
  bending it. No nested ternary and no braced one-line `if` in `5ef50ac..HEAD`; the four braced
  `if`s in the diff all have multi-line bodies, which `curly: multi-line` requires.
- Cold start from `docker compose down -v`: healthy, `/health` and `/health/ready` 200,
  availability 401 without a token. Live on that stack: the same-currency reserve answered
  `201` with `rate` `1`, 275 000 000 EUR at `1.10` answered `201` with `reservedAmount` and
  `held` 302 500 000 and `rate` `1.1`, the same request without a rate answered
  `400 VALIDATION_FAILED` naming `rate`, and availability read `reserved` 422 500 000, the sum
  of both. Stack torn down.
- Result: PASS, with one minor owed to `/ship`.

## 2026-09-23, review S-04 (cross-currency reservations), Opus
- Run on Opus, not Fable: the Fable credits ran out and Marcin decided to run the review on
  Opus anyway. `CLAUDE.md §8` puts `/review` on Fable in a fresh context precisely so the
  reviewer is not the implementer's model, and the implementation was also written on Opus
  (see the implement entry of 2026-09-22), so the usual independence of the review model did
  not hold for this slice. The context was fresh, the model was not. Recorded as a decision,
  not an oversight.
- REVIEW S-04: 6 findings (0 blockers / 2 majors / 4 minors). Not a pass: the two majors go
  back to `/implement`, then `/verify` and `/review` run again.
- Major 1, `infrastructure/persistence/mappers.ts:82`: `Rate.parse(row.rate.toString())` cannot
  read back every rate the contract accepts. Prisma's `Decimal.toString()` renders a value whose
  exponent is at or below minus seven in exponential notation, so `0.0000001` comes back as
  `"1e-7"` and `0.00000001` as `"1e-8"`, neither of which matches `Rate`'s decimal pattern. The
  DTO and ADR-0006 both allow eight fractional digits, so such a rate can be stored (a large
  enough invoice amount still converts to a non-zero amount and passes decision 4's guard), and
  every later read of that reservation then throws a `RangeError` out of the mapper, which the
  filter renders as a `500`. The nearest victim is the duplicate check in `ReserveCapacity`,
  which reads the reservation on every reserve, so AC-05's `409` becomes a `500`. Verified
  against the generated client's `Prisma.Decimal`, not inferred. The integration round trip
  pins `0.0067` only, so the gate cannot see it.
- Major 2, `infrastructure/http/programs.controller.ts:62`: a body with `"rate": null` answers
  `500`, not the `400` AC-07 and AC-08 promise. `@IsOptional()` skips validation for `null` as
  well as `undefined`, so `null` passes the pipe untouched; the controller's guard tests for
  `undefined` only, so `Rate.parse(null)` runs and throws a `RangeError`, which is not an
  `HttpException` and becomes `INTERNAL_ERROR`. Verified by running the real `ValidationPipe`
  and the real DTO over that body. `Rate.parse`'s own comment says the DTO refuses malformed
  input on HTTP; for `null` it does not.
- Minor, `common/filters/error-body.ts:16`: `export {VALIDATION_FAILED_CODE};` has no importer
  anywhere in the repo, so it is a re-export kept for a caller that does not exist
  (`CLAUDE.md §3`, no dead code, no compat shims).
- Minor, `infrastructure/http/reservation.dto.ts:7`: the class comment still reads "`rate`
  arrives with S-04; until then it is refused", directly above the `rate` property that now
  exists.
- Minor, `api/test/reservations.e2e-test.ts:241`: the AC-06 expectation computes availability
  from the literal `1_000_000_000` although `TEN_MILLION_USD` is the constant for that value
  (`CLAUDE.md §4`, fixture values in named constants).
- Minor, `README.md:90` and `wiki/plan/plan.md:104`: both still describe the interim
  `CURRENCY_MISMATCH` behaviour on a reservation, the README as a live error row with no
  cross-currency example, the plan as what the S-03 use case test asserts. The README half was
  already owed to `/ship` by `/verify`; the plan row is the same drift in the other file.
- Judged and found sound, so no finding: the move of `VALIDATION_FAILED_CODE` into
  `common/errors/domain-error.ts` is the right call rather than a way around the boundary. The
  lint rule carves out `common/errors/` for the domain by name, `domain-error.ts` has no imports
  at all, and the alternative (the domain naming the literal `'VALIDATION_FAILED'` a second
  time) would let the filter and the domain drift apart.
- Judged and found sound, so no finding: `Money.convert`'s arithmetic. The result is
  `(amount × unscaled × 10^exp(target) + divisor / 2) / divisor` with
  `divisor = 10^(rate.scale + exp(source))`, all in `bigint`. The scaling is right in both
  directions and all five pinned examples recompute. The half is exact because `divisor` is a
  power of ten, even for every scale above zero, and at `divisor` one the half is zero and
  nothing rounds. A tie lands exactly on a multiple of `divisor` and rounds up, which is half up
  toward positive infinity, and `Money` admits no negative amount, so there is no half down
  branch to get wrong. Nothing can overflow (`bigint`) and nothing can divide by zero (`divisor`
  is at least one). A conversion that rounds to zero is not silent on the one path that exists:
  `ReserveCapacity` refuses it as a `400` naming `invoiceAmount` (decision 4). It is silent in
  `Money.convert` itself, which matters for S-05's release path, and the slice file's hand-off
  note already says so.
- Spec axis, otherwise clean: AC-06's e2e asserts the whole Then clause including the stored
  rate reading canonical and availability down by exactly the converted amount, and the ledger
  invariant helper runs after every test in that file. AC-07's e2e asserts both refusals name
  `rate` in `details`, that nothing was reserved, and that `1.00` is accepted and reads `1`.
  INV-08 is proven at both halves the plan names. The nine local decisions are all honoured in
  the code, including the duplicate check running before the rate rule and the migration adding
  and dropping its default in one file. The rate rule sits inside the transaction after the row
  lock, so INV-01's critical section is unchanged: two parallel reserves still serialise on the
  program row and a refusal rolls back without writing.

## 2026-09-23, implement S-04 (review fixes, round 1), Opus
- Both majors from review round 1 were real, and I reproduced each before touching the code
  rather than taking the report on trust.
- Major 1, the rate round trip. decimal.js renders anything below `1e-7` in exponential form,
  so a rate of `0.0000001` or `0.00000001`, both inside the eight places the DTO and ADR-0006
  allow, came back from Prisma as `1e-7` and `1e-8`, which `Rate.parse` refuses. The throw
  leaves the mapper on every later read of that row, so the duplicate check inside
  `ReserveCapacity` would turn AC-05's `409` into a `500`. Red first: a new integration case
  storing `0.00000001` failed with `RangeError: Rate 1e-8 is not a decimal of up to 8 places`.
  Fixed by reading the column with `toFixed()`, which never switches notation.
- Major 2, an explicit `"rate": null`. `@IsOptional()` skips validation for `null` as well as
  `undefined` (read in `class-validator/cjs/decorator/common/IsOptional.js`), so `null` reached
  the controller unvalidated and `Rate.parse(null)` threw a `RangeError`, a `500` where AC-07
  promises a `400`. Replaced with `@ValidateIf((dto) => dto.rate !== undefined)`, so absent
  stays legal and null is a wrong value. I wrote this case alongside the fix rather than before
  it, so afterwards I put `@IsOptional()` back and watched the e2e fail, then restored the fix:
  the test does catch the bug it claims to.
- Minors fixed: the `VALIDATION_FAILED_CODE` re-export in `error-body.ts` had no importer and
  is gone; `ReserveRequestDto`'s class comment no longer says `rate` arrives with S-04 while
  sitting above `rate`; the AC-06 expectation uses `TEN_MILLION_USD` instead of repeating the
  literal.
- Two minors are not mine to fix and stay with `/ship`: the README's `CURRENCY_MISMATCH` row
  and missing cross-currency example, and the S-03 `extra` row in `wiki/plan/plan.md` that
  still describes the interim behaviour. `/implement` may not edit the requirement checklist.
- The review ran on Opus because the Fable credits ran out, and the implementation was written
  on Opus too, so the review model's usual independence did not hold. Worth knowing when
  reading this round: a shared blind spot would not have been caught by the model split.
- `npm run gate` green: unit 111, integration 25, e2e 39, cold start 3. Nothing committed.

## 2026-09-23, verify S-04 (second pass, after review round 1), Sonnet
- `npm run gate` green on 5dfc519: prose clean, unit 111/111, integration 25/25 (one more than
  the first pass, the eight place rate round trip), e2e 39/39, cold start 3/3, web green.
- Coverage 3/3 at the planned level, unchanged files: AC-06 and AC-07 through HTTP, INV-08 unit
  in `domain/money.test.ts` and e2e in `api/test/docs.e2e-test.ts`. No skipped or focused tests,
  no `@nestjs` under `domain/`, no ORM or Kafka import outside `infrastructure/`.
- All four code findings from review round 1 are closed and each was checked against the
  behaviour it broke, not just against the diff. On a cold started stack: a reservation at rate
  `0.00000001` answered `201` and read the rate back as `0.00000001`, and asking for the same
  invoice again answered `409 RESERVATION_ALREADY_EXISTS` rather than the `500` the exponential
  form used to cause through the duplicate check; `"rate": null` answered
  `400 VALIDATION_FAILED` naming `rate`. The `VALIDATION_FAILED_CODE` re-export is gone, the
  stale DTO comment is gone, and the AC-06 expectation uses `TEN_MILLION_USD`.
- Cold start from `docker compose down -v`: healthy, `/health` and `/health/ready` 200,
  availability 401 without a token. Stack torn down.
- Two findings stay open for `/ship`, both documentation and both already named by review round
  1: `README.md:90` still lists `422 CURRENCY_MISMATCH` as a reservation error and has no
  cross-currency example, and `wiki/plan/plan.md:104` still says the S-03 use case test asserts
  `CURRENCY_MISMATCH`, which it no longer does. Line 109 of the same file was already marked
  superseded during the plan revision.
- Result: PASS.

## 2026-09-23, review S-04 round 2 (cross-currency reservations), Opus
- Run on Opus again, not Fable: the Fable credits are exhausted. The implementation, review
  round 1 and this round were all written by the same model, so the independence `CLAUDE.md §8`
  buys by putting `/review` on another model still does not hold. A blind spot shared with the
  implementation would have survived both rounds, and this entry is the only record of that.
- REVIEW S-04: 5 findings (0 blockers / 0 majors / 5 minors). A pass by the skill's rule, so the
  slice may go to `/ship`; the five minors are listed below and none of them blocks it.
- Both round 1 majors are genuinely closed, checked against the mechanism and not only against
  the test. `mappers.ts:85` now reads the column with `row.rate.toFixed()`, which decimal.js
  documents as normal notation for any magnitude, and `NUMERIC(20,8)` can never hand back more
  than 12 integer or 8 fractional digits, so the read is total for every value the column can
  hold rather than merely correct at `0.00000001`. `reservation.dto.ts:46` skips validation only
  for `undefined`, so `null` reaches `@IsString()` and answers `400`; the property keeps its
  validation metadata, so `whitelist` does not strip it, and `required: false` in the OpenAPI
  document is unchanged. Neither fix introduced a problem of its own. The three round 1 minors
  that were taken are also gone; the two documentation ones are still open for `/ship`.
- The boundary question was worked through end to end rather than sampled. The DTO's
  `^\d{1,12}(\.\d{1,8})?$` plus `/[1-9]/` accepts exactly the set `Rate.parse` accepts: for a
  string of digits and at most one dot, the positivity regex matches if and only if the unscaled
  `bigint` is non zero, so `Rate.parse` in `programs.controller.ts:62` cannot throw for a body
  the pipe let through. `Rate.toString()` is always at most 12 integer and 8 fractional digits,
  which is exactly what `NUMERIC(20,8)` stores, so no insert can be refused or silently rounded.
  The conversion cannot overflow `BIGINT` or `jsonInteger`: `creditLimit` is capped at
  `Number.MAX_SAFE_INTEGER` (`capacity-update-message.dto.ts:44`), `Program.reserve`
  (`program.ts:103`) refuses a held above available before any write, and a conversion to nothing
  is caught at `reserve-capacity.use-case.ts:83`. Half up holds: `(n + d/2) / d` truncating
  toward zero is round half up for a non negative `n`, and `d` is either one or an even power of
  ten, so `d/2` is exact. INV-08 needs no new critical section: the row lock from ADR-0008 is
  unchanged and `Money.convert` is pure.
- Minor, spec, `api/test/reservations.e2e-test.ts:219`: AC-06 says the rate is stored on the
  reservation, and the tagged e2e asserts it only on the `201` body, which is rendered from the
  aggregate still in memory. The one proof that the rate survives storage is the untagged
  integration test at `prisma-capacity.integration-test.ts:180`, and `CLAUDE.md §4` says a
  supporting test that is a requirement's only proof is not supporting. A second reserve of the
  same invoice would return the stored reservation in the `409` body and close it over HTTP.
- Minor, standards,
  `api/prisma/migrations/20260922180000_reservation_rate/migration.sql:5`: the column accepts any
  `NUMERIC(20,8)`, including zero and negatives, which `Rate.parse` refuses; such a row would
  turn every later read of it into a `500` out of `mappers.ts:85`, which is the failure class
  round 1's first major was. The table already carries `reservations_held_within_reserved` and
  the ledger `capacity_movements_attributable`, so `CHECK ("rate" > 0)` is the house pattern and
  is the one missing. Not reachable through the service today, since the mapper is the only
  writer.
- Minor, standards, `wiki/slices/S-04-cross-currency-reservations.md:119`: the slice file
  promises `JPY` and `KWD` in `api/test/support/programs.ts` for the exponent case. Neither the
  constants nor any e2e with a currency outside two decimals exists, so the exponent table is
  proven in `domain/money.test.ts` and `domain/currency-exponents.test.ts` and never through HTTP
  against a real program. Either the case lands or the slice file records that it was dropped.
- Minor, standards, `api/src/modules/capacity/domain/reservation.test.ts:99` and `:106`: `'EUR'`
  written inline twice in a file whose convention is UPPERCASE fixture constants (`USD`,
  `PROGRAM_ID`, `INVOICE_A`). `CLAUDE.md §4` asks for fixture values in UPPERCASE constants.
- Minor, spec, `wiki/spec/glossary.md:242`, `:247` and `:251`: `Adapter`, `Seam` and `Fake`
  illustrate themselves with a config file rate table, with "`RateProvider` is a port;
  `ConfigRateProvider` is the adapter used in this brief" and with a rate provider holding one
  fixed rate, while A-02 decided there is no `RateProvider`, no rate table and no
  `RATE_UNAVAILABLE`. S-04 is the slice that made the rate real, so the examples now teach a
  newcomer something the service does not contain. Documentation, for `/ship`.
- Still open from round 1 and still owed to `/ship`, both documentation and neither counted
  again here: `README.md:90` lists `422 CURRENCY_MISMATCH` as a reservation error and the README
  has no cross-currency example with `rate`, and `wiki/plan/plan.md:104` still says the S-03 use
  case test asserts `CURRENCY_MISMATCH`.
- Nothing was fixed, committed or pushed.

## 2026-09-23, implement S-04 (review fixes, round 2), Opus
- Review round 2 passed with five minors. Marcin chose to close the three that belong to this
  slice and carry the rest to `/ship`.
- `[AC-06]` now proves what the criterion actually says. It said the rate is stored, and the
  tagged test asserted it only on the `201` body, which is rendered from the aggregate still in
  memory. It now reserves the same invoice again and asserts `rate` `1.1` and the converted
  amount inside the `409` body, which is read back out of the database through the duplicate
  check. The integration round trip stays as the narrower proof it always was.
- The exponent rule is proven through HTTP, in both directions, which the slice file promised
  and the first pass had not delivered: a KWD program (three decimals) taking a 1.00 USD invoice
  at `0.30712` reserves 307 minor units rather than 30, and a USD program taking a 1 000 JPY
  invoice (no decimals) at `0.0067` reserves 670. Untagged, like the casing tests in S-03: the
  rule belongs to A-10, not to an AC or an INV. `JPY` and `KWD` join `test/support/programs.ts`
  as the slice said, and both are used, so neither constant is dead.
- Inline `'EUR'` in `reservation.test.ts` replaced by the file's UPPERCASE constant.
- Left for `/ship`, all recorded by review round 2: no `CHECK ("rate" > 0)` on the migration
  (unreachable through the service, the mapper is the only writer, but the table already carries
  a CHECK as the house pattern); the glossary illustrating `Adapter`, `Seam` and `Fake` with a
  `RateProvider` and a config rate table that A-02 decided against; `README.md:90`; and
  `wiki/plan/plan.md:104`.
- `npm run gate` green: unit 111, integration 25, e2e 40, cold start 3. Nothing committed.

## 2026-09-23, verify S-04 (third pass, after review round 2), Sonnet
- `npm run gate` green on 443c5d0: prose clean, unit 111/111, integration 25/25, e2e 40/40 (one
  more than the second pass, the exponent case through HTTP), cold start 3/3, web green.
- Coverage 3/3 at the planned level, unchanged files. No skipped or focused tests, no `@nestjs`
  under `domain/`, no ORM or Kafka import outside `infrastructure/`.
- The three minors Marcin chose to close are closed, and the two that mattered were checked
  against behaviour rather than against the diff. `[AC-06]` now asserts the rate inside the
  `409` body, which is the row read back out of the database, so the criterion's "the rate is
  stored" has a tagged test of its own instead of leaning on an untagged integration case.
- Live on a cold started stack: a 1 000 JPY invoice (no decimals) at `0.0067` on a USD program
  reserved 670 minor units, and asking for the same invoice again answered `409` carrying the
  stored rate `0.0067` and `reservedAmount` 670. The exponent rule and the stored rate are both
  true over HTTP, not only in unit tests.
- `JPY` and `KWD` are in `test/support/programs.ts` and both are used, so the slice file's
  promise is kept and neither constant is dead. Inline `'EUR'` is gone from
  `reservation.test.ts`.
- Four findings stay open, all for `/ship` and all already recorded: no `CHECK ("rate" > 0)` on
  the migration; the glossary's `Adapter`, `Seam` and `Fake` entries illustrated with a
  `RateProvider` and a config rate table that A-02 decided against; `README.md:90`; and
  `wiki/plan/plan.md:104`.
- Result: PASS.

## 2026-09-23, ship S-04, Opus
- Precondition with one caveat, stated rather than glossed: the last `VERIFY` is PASS on
  443c5d0, but the last `REVIEW` (round 2, zero blockers, zero majors) read 5dfc519, so it is
  one commit stale. That commit touched only test files, test support constants and the wiki,
  no production code, and Marcin decided to carry the minors rather than run a third review.
- `wiki/plan/plan.md`: AC-06, AC-07 and INV-08 are `done` with their test files, and eight
  `extra` rows cover the supporting tests. The S-03 `extra` row that still said its use case
  test asserts `CURRENCY_MISMATCH` is corrected, since S-04 removed that case with the interim
  rule. Commit column waits for the merge commit.
- README gains the cross-currency example with `rate` and loses the `CURRENCY_MISMATCH` row,
  which a reservation can no longer produce. Both run literally on a fresh
  `docker compose up --wait`: 275 000 000 EUR at `1.10` answered `201` with 302 500 000 and
  `rate` `1.1`, and the same request without a rate answered `400`. The JPY claim in the new
  text was already confirmed live in the third verify pass (670 minor units).
- ADR-0006 was accepted before the slice and is unchanged; no ADR to finalise. No assumption is
  missing from the register: A-02 was already there and A-10 took both amendments through
  `/spec` in #28 before implementation started.
- Changelog row, slice status `done`, slice index and Home updated; Home names S-05 next and
  records that ADR-0009 is still `proposed` and must be decided in the S-05 plan PR.
- Two findings carried to S-05, both named in the changelog's limitations so they are visible
  to a reader who never opens the work-log: no `CHECK (rate > 0)` on `reservations.rate`
  (unreachable through the service today, but the table's other constraint sets the pattern),
  and the glossary illustrating `Adapter`, `Seam` and `Fake` with a `RateProvider` and a config
  rate table that A-02 decided against. The second is `/spec` work, not `/ship`'s.
- Worth recording once more where it will be read: the implementation and both review rounds
  ran on Opus, the first because Marcin chose it and the rest because the Fable credits were
  exhausted. The model split `CLAUDE.md §8` relies on for review independence did not happen
  for this slice.

## 2026-09-23, decision: ADR-0009 accepted as recommended, Opus
- Marcin decided ADR-0009 on the recommendation: Option 2 for how `held` follows releases, and
  Option A for the scope of `releaseId`. Status moves from `proposed` to `accepted` and the
  index follows, so `/implement S-05` is no longer blocked on an undecided ADR.
- Option 2: the reservation stores `releasedInvoiceAmount` and `held` is derived from what is
  left of the invoice (`heldAfter = round(remaining * rate)`) rather than decremented per
  release. Written down with the reason Option 1 was declined: converting each instalment on its
  own makes AC-12 hold only by special case, because three instalments at an awkward rate need
  not sum back to what was reserved. Deriving from the remainder means every `held` is one
  rounding of one product, so error cannot accumulate and a fully released invoice closes at
  exactly zero with nothing special about it.
- Option A: `UNIQUE (reservation_id, release_id)`. The same `R-1` on another invoice is a
  different release, which is the plain reading of A-09. Option B would refuse a client that
  numbers repayments per invoice, which is a normal scheme to have.
- Consequences extended while writing the decision, all of which S-05's plan has to carry:
  the `released_invoice_amount` column backfilled to zero for the S-03 and S-04 rows;
  `RELEASE_EXCEEDS_HELD` reporting both `held` and `remainingInvoiceAmount`; `releasedInvoiceAmount`
  on the reservation read (AC-19); and the observation that the stored rate is now load bearing
  on every release rather than only at reservation time, so a wrong rate is wrong for the life
  of the reservation.
- Branch `docs/adr-0009-decision` from `main` at 60d7f42. Wiki only, no code.

## 2026-09-23, plan S-05 (revision before implement), Opus
- Targeted run for a slice that already existed: S-05 was written on 2026-09-19, before any code
  and before ADR-0009 was decided. S-04 shipped today and the ADR was accepted the same day, so
  the file was reconciled with both rather than rewritten. The twelve requirement rows in
  `wiki/plan/plan.md` are untouched: all twelve test names still match the slice file exactly,
  checked name by name, and the levels are unchanged (eleven e2e, INV-02 unit). The slice index
  is unchanged too.
- Drift found and fixed in the slice file. The error envelope was the big one: a domain error's
  `details` are spread at the top level of the body next to `code`, and `details` as a JSON
  field is a list of message strings used only by validation failures. The first version wrote
  `details.appliedAt`, `details.heldAfter`, `details.held` and `details.remainingInvoiceAmount`;
  all four are top level. This is the same drift the S-03 revision found, so it was worth
  looking for.
- ADR-0009 is no longer a pointer: the formula is written out. `held` derives from what is left
  of the invoice, the reservation stores `releasedInvoiceAmount`, over-release is judged in
  invoice currency, and `releaseId` is unique per reservation through a partial unique index.
- Checked against the shipped code rather than assumed: `capacity_movements` already carries
  `reservation_id`, `release_id` and `reason`, so the migration adds one column, one index and
  the carried CHECK; `Ledger.recompute` chains on `deltaHeld` and special cases only `limit_set`,
  so a release row recomputes with no change; `ReservationRepository` has only `findByInvoice`
  and `add` since S-03 removed the listing method, so `save` and a movement read are new.
- AC-12's numbers were verified by hand and they discriminate, which is the point of that test:
  1 000 000 EUR at `1.13` released as 33 333 333, 33 333 333 and 33 333 334 minor units closes
  at exactly 0 under the accepted Option 2, while rounding each release on its own (the declined
  Option 1) gives 112 999 999 and leaves `held` at 1. A test that both options pass would prove
  nothing.
- Ten local decisions recorded so review can hold the code to them, including that the release
  amount carries no currency (the reservation knows it), that `deltaHeld` travels as a `bigint`
  difference rather than loosening `Money` to admit negatives, and that idempotency is read from
  the ledger rather than from a second table, since a release always produces a movement.
- The two findings carried from S-04 are the slice's first commit, with the glossary half marked
  as `/spec` work. A third `/spec` item joins them: `releasedInvoiceAmount` is a new domain word
  and needs a glossary entry before `/review`.
- Branch `docs/plan-S-05` cut from `main` at 6af3675. Files: the S-05 slice file, `Home.md`,
  this entry. `wiki/plan/plan.md` and the slice index needed no change. Nothing committed.

## 2026-09-24, spec: a reservation is closed when the invoice is released, not when held rounds away, Opus
- Review round 1 of S-05 found that `held` can round to zero while the invoice still owes, which
  left the reservation permanently unreleasable. Reproduced before deciding anything: a
  1 000 000 IDR minor invoice on a USD program at rate `0.000065` reserves 65 USD minor;
  releasing 999 000 IDR leaves `held` 0 with 1 000 IDR still owed, status `closed`, and every
  later release answers `409 RESERVATION_ALREADY_RELEASED`.
- The code was faithful to the spec, so the spec is what changed. AC-15 said "Given `INV-A` has
  `held` 0", and the glossary said "Active reservation: `held > 0`. Closed reservation:
  `held = 0`". Marcin decided: a reservation is closed when the whole invoice amount has been
  released, so status follows what is left to release rather than what is held. A reservation
  may now be active with `held` zero: it occupies none of the limit and can still be released to
  the end. AC-15 amended with a Changes row; the glossary entry rewritten with the rounding case
  spelled out, since that is the whole reason for the distinction.
- What else I checked rather than assumed, because a status rule touches more than one
  requirement: INV-02 (`0 <= held <= reservedAmount`) is unaffected; INV-03 (`reserved` is the
  sum of `held` of active reservations) is unaffected, because an active reservation with `held`
  zero contributes zero; AC-11 stays true, because releasing with no amount always takes the
  remaining invoice amount to zero, so `held` 0 and `closed` still coincide there; AC-12 and
  AC-13 speak only of `held` and are unaffected.
- One requirement is affected and is not this slice's: **AC-27** (S-06, reconciliation) says a
  snapshot that drops a reservation leaves it with `held` 0 **and status closed**. Under the new
  rule those two coincide only if the adjustment also takes `releasedInvoiceAmount` to the
  invoice amount. ADR-0011 is still `proposed` and already owes an answer for what
  `invoiceAmount` and `rate` mean on a reconciliation-created reservation; it now also owes this.
  Flagged here rather than amended, because it is S-06's decision to make.
- Glossary also gains `Released invoice amount`, the word S-05 puts in code and on the API, with
  a worked number.
- C2 carried from S-04 closed: `Adapter`, `Seam` and `Fake` no longer illustrate themselves with
  a `RateProvider`, a `ConfigRateProvider` and a config rate table, none of which exist because
  A-02 decided the rate comes from the client. They now name seams the service has: a Prisma
  repository, a Kafka consumer, the `Clock` port and its fixed-time fake.
- Branch `docs/closed-reservation-and-glossary` from `main` at 4bd138b. Wiki only, no code.

## 2026-09-24, spec: over-release is judged on the invoice, not on held, Opus
- Review round 2 of S-05 found the glossary still saying "A release larger than `held` is
  rejected". ADR-0009 decided otherwise and S-05 implements otherwise: over-release is judged in
  invoice currency against what the invoice still has to give back, so a release that is legal
  in invoice terms cannot fail on a rounding boundary. The ubiquitous language was contradicting
  an accepted ADR in the area the slice implements.
- Corrected in `Release`, with the reason named rather than just the rule, since the whole point
  of judging on the invoice is the rounding boundary.
- No AC or INV changed: AC-13 says `RELEASE_EXCEEDS_HELD` and no state change, and says nothing
  about which quantity the comparison uses. The glossary has no `## Changes` table, so no row is
  owed.
- I first made this edit on the slice branch, which `/implement` may not do, and took it back
  out. It belongs here, the way #32 did.
- Branch `docs/release-glossary-over-release` from `main` at 49c34c0. Wiki only, no code.
## 2026-09-24, spec: A-08 and A-09 catch up with ADR-0009 and the amended AC-15, Opus
- Review round 3 of S-05 found both. AC-15 was amended in #32 and the glossary in #33, but the
  assumptions those criteria reference were never touched, so the register still described a
  service that no longer exists. Worth naming plainly: three rounds of review and four of my own
  fix rounds all read the code, the OpenAPI document and the glossary, and none of us opened
  `wiki/spec/assumptions.md`.
- A-08 amended: releases run until the whole invoice has been released, not until `held` is
  zero; `held` is derived from what the invoice still has to give back rather than decremented
  per release (ADR-0009); and over-release is judged in invoice currency, because judging it
  against `held` would let a release that is legal in invoice terms fail on a rounding boundary.
- A-09 amended: a new `releaseId` is refused once nothing is left to release, and that is not
  the same as `held` reaching zero, since a remainder worth less than half a minor unit of the
  program currency rounds `held` away while the invoice still owes.
- Both have Changes rows. No AC or INV changed: AC-13 names the code and the no-state-change
  rule without saying which quantity the comparison uses, and AC-15 was already amended.
- Branch `docs/release-assumptions` from `main`. Wiki only, no code.
## 2026-09-25, spec: AC-27 says what closing means after the AC-15 amendment, Opus
- Review round 4 of S-05 found it, and it is the third round running whose miss was in the wiki
  rather than in the code. AC-15 was amended so that a reservation is closed when the whole
  invoice has been released rather than when `held` reaches zero, which split two things AC-27
  states as one thing: "`held` 0, status closed".
- Marcin decided: a snapshot that drops a reservation counts the whole invoice as released, so
  the two coincide again. That is what a snapshot saying "this reservation is gone" means, and
  it keeps one status rule rather than one per source. AC-27 clarified with a Changes row.
- ADR-0011, still `proposed`, carries the consequence: whatever `invoiceAmount` it settles on
  for a snapshot-created reservation, an omitted reservation has to end with
  `releasedInvoiceAmount` equal to it. Recorded there rather than left for S-06 to rediscover.
- No other AC or INV is affected: AC-26 and AC-28 to AC-31 speak of `held`, adjustments and
  `asOf`, none of them of status.
- Branch `docs/ac-27-adjustment-closes` from `main`. Wiki only, no code.
## 2026-09-23, implement S-05 (releases), Opus
- Branch `slice/S-05-releases` from `main` at 4bd138b. Run on Opus although the slice is
  `risk: high`: the Fable credits are exhausted and Marcin decided to run it here. Third slice
  in a row without the model split `CLAUDE.md §8` asks for.
- C1 from S-04 closed first, test first: the raw insert of a zero rate now fails on
  `reservations_rate_positive`. C2, the glossary's `RateProvider` examples, is `/spec` work and
  is still owed before `/review`, together with an entry for `releasedInvoiceAmount`.
- One thing the slice file did not spell out, and it mattered. `CapacityMovement.deltaHeld` was
  a `Money`, and `Money` admits no negative amount, so a release row could not be represented at
  all: `toMovement` would have thrown `Money.of` on the way out of a `delta_held` that the column
  already stores as a signed BIGINT. Decision 3 of the slice had declined a second money type and
  said a release's delta is a `bigint` difference; the consistent conclusion is that the movement
  carries a signed `bigint` too, with the row's currency where it already lives
  (`limitAfter.currency`). Changed across the module: the type, `Ledger.recompute`, `Program`,
  the mappers and three test files. `Ledger` now reports a chain that would take a reservation
  below zero as broken at that row rather than throwing, which is INV-02 at the recomputation.
- The movement also gained `releaseId` and `reason`, which AC-19 needs and the columns have
  carried since S-02; `toMovementColumns` was writing null into both.
- `jsonInteger` now guards magnitude rather than only the upper bound, because a ledger delta is
  signed and a number too large to be exact is just as wrong with a minus in front of it.
- Domain, application and infrastructure otherwise as the slice file planned: `Reservation.release`
  deriving `held` from what the invoice has left, `Program.release`, the four errors, the
  `ReleaseCapacity` use case checking the repeat before the amount, `GetReservation`, the two
  routes, and the migration with the column, the partial unique index and C1's CHECK.
- A second thing worth naming: the `afterEach` ledger helper opened one repeatable-read
  transaction per program, and S-03 chose to check every program in the database rather than
  track ids. That is O(programs) per test, so it grew with the suite and finally ran past the
  180 s hook timeout in a full e2e run once S-05 added a suite. Rewritten to three queries for
  the whole database in one transaction, grouped in memory: the same guarantee, the releases
  suite back to 34 s. Found because the full gate failed while the file alone passed, which is
  exactly the kind of thing running only the fast loop would have hidden.
- Tests beyond the plan, for `/ship` to add to `wiki/plan/plan.md`: `Reservation.release` for the
  partial, absent-amount, exact-closing, over-release and already-closed cases;
  `Program.release` lowering `reserved` and letting an overcommitted program recover;
  `ReleaseCapacity` for each error and for the repeat running before the amount; and the
  integration case for the zero rate CHECK.
- `npm run gate` green: unit 129, integration 26, e2e 51, cold start 3. Nothing committed.

## 2026-09-24, verify S-05, Sonnet
- `npm run gate` green on 1aeeda8: prose clean, unit 129/129, integration 26/26, e2e 51/51,
  cold start 3/3, web green.
- Coverage 12/12 at the planned level: AC-10 to AC-19 and AC-34 through HTTP in
  `api/test/releases.e2e-test.ts`, INV-02 as a unit property test in
  `domain/reservation.invariants.test.ts`. No skipped or focused tests.
- AC-12 uses the numbers the plan said would discriminate, not a case both options pass:
  100 000 000 EUR minor at `1.13` released as 33 333 333, 33 333 333 and 33 333 334. Confirmed
  live on a cold started stack, where the intermediate values matched the hand calculation to
  the minor unit: `held` 75 333 334, then 37 666 667, then exactly 0 with status `closed`. Under
  the declined Option 1 the three roundings would have summed to 112 999 999 and left 1.
- A repeated `releaseId` answered `409` on the same live stack.
- INV-02's property test is not trivially true: 1 000 seeded sequences of 12 releases each at
  five rates that do not divide evenly, over-releases caught and counted, and every sequence
  that still holds something is closed at the end and asserted to land on exactly zero. The
  failure message carries the seed and the whole history.
- Layer boundaries hold: no `@nestjs` under `domain/`, no ORM or Kafka import outside
  `infrastructure/`. No nested ternary in `4bd138b..HEAD`.
- Cold start from `docker compose down -v`: healthy, `/health` and `/health/ready` 200,
  availability 401 without a token. Stack torn down.
- One finding, owed to `/ship` and already in the slice's definition of done: `README.md`
  documents no release route at all, so it shows neither a partial release, a full one, a
  repeated `releaseId` nor the reservation read. What it does document still works.
- Result: PASS.

## 2026-09-24, review S-05, Opus
- Fresh context review of `4bd138b..HEAD` (implementation commit 1aeeda8) plus the uncommitted
  verify lines, against `CLAUDE.md` and against AC-10 to AC-19, AC-34, INV-02, A-02, A-08, A-09,
  A-10, ADR-0006, ADR-0008, ADR-0009 and the slice's ten local decisions.
- Model independence did not hold for this slice. `CLAUDE.md §8` puts a `risk: high` slice on
  Fable for `/implement` and Fable in a fresh context for `/review`. The Fable credits are
  exhausted, so the implementation ran on Opus and this review ran on Opus too. The context was
  fresh, the model was not independent. Recorded plainly rather than glossed.
- The `Money` to signed `bigint` change on `CapacityMovement.deltaHeld` is the right call: a
  release row cannot be a `Money`, the column is a signed BIGINT, and a second money type for
  one field would be worse. The ripple is complete: every use of `deltaHeld` in `api/` and
  `web/` was checked and none still expects a `Money`. Two doc comments were left behind by the
  edits, and the one currency guarantee the type used to carry at `Program.release` is now
  unchecked; both are minors below.
- The rewritten `afterEach` ledger helper still proves what it claims. One repeatable read
  transaction over three whole-table queries gives every program the same snapshot, so it is in
  fact stronger than the old transaction per program, and the grouping covers every program in
  the database. INV-03 and INV-04 hold as before.
- Idempotency and ordering are correct. The duplicate check runs before the amount rules
  (AC-16), `held.isZero()` runs before the amount rules inside `Reservation.release` (AC-15
  before AC-13), the partial unique index and the in-transaction check agree on scope, and two
  concurrent releases carrying one id cannot both get through because both writers take the
  program row lock first (ADR-0008). The `heldAfter` arithmetic is right for several preceding
  releases, but no test discriminates that case.
- REVIEW S-05: 15 findings (0 blockers / 7 majors / 8 minors). Not a pass: the majors return to
  `/implement`, then `/verify` and `/review` run again.

Findings, most severe first:

- [major] [standards] `api/src/modules/capacity/infrastructure/http/reservation.dto.ts:158`: a
  client input answers `500`. `@IsOptional()` on `amount` skips every validator for an explicit
  `null` as well as for `undefined`, so `{"releaseId": "R-1", "amount": null}` passes the
  `ValidationPipe` with zero errors and `programs.controller.ts:101` then evaluates
  `BigInt(null)`, which throws a `TypeError` the filter renders as `500 INTERNAL_ERROR`.
  Confirmed by running the DTO through the app's own pipe options. Lines 71 to 74 of this same
  file document this exact trap for `rate` and use `@ValidateIf` to avoid it; the new fields did
  not follow. `reason` at line 170 has the milder form: an explicit `null` becomes `repaid`
  instead of the `400` a wrong value deserves.
- [major] [spec] `api/test/releases.e2e-test.ts:170`: the test asserts `PROGRAM_NOT_FOUND` for a
  release on a program that does not exist, but AC-14's Then clause is
  `404 RESERVATION_NOT_FOUND` and the slice's own test row puts that case under AC-14 "as the
  same criterion". `release-capacity.use-case.ts:40` decides it. Either answer is defensible;
  resolving it in the test rather than in the spec is not, and there is no `## Changes` row and
  no assumption recording the choice.
- [major] [standards] `api/src/modules/capacity/infrastructure/http/programs.controller.ts:82`:
  the published contract now says the wrong thing. `ApiNotFoundResponse` on the release route
  reads "RESERVATION_NOT_FOUND: no reservation for that invoice, or no such program", while the
  code answers `PROGRAM_NOT_FOUND` for the second half.
- [major] [spec] `api/src/modules/capacity/domain/reservation.ts:177`: `held` can reach zero
  while the invoice still owes something, and the reservation is then stuck. `heldAfter` is
  `round((remaining - amount) * rate)` half up, so any remainder worth less than half a minor
  unit of the program currency rounds to `0`, `status` at line 144 turns `closed`, and every
  later release hits the `held.isZero()` guard at line 169 and gets
  `409 RESERVATION_ALREADY_RELEASED`. `releasedInvoiceAmount` can then never reach
  `invoiceAmount`. Reachable with an ordinary low value invoice currency: an IDR invoice on a
  USD program at about `0.000065` leaves a 100 IDR remainder worth zero cents. Nothing in A-08,
  A-09 or ADR-0009 says what a reservation that holds nothing but still owes something is, so
  the code is deciding a spec question on its own. INV-02's property test
  (`domain/reservation.invariants.test.ts:63`) guards its closing release with
  `if (!reservation.held.isZero())`, so it steps around this state instead of asserting anything
  about it.
- [major] [spec] `api/src/modules/capacity/application/release-capacity.use-case.test.ts:111`
  and `api/test/releases.e2e-test.ts:191`: the AC-16 tests cannot fail on the thing AC-16 names.
  Both repeat the only release the reservation has, so "the original outcome" and "the current
  state" are the same number, and an implementation that reported the latest `held` instead of
  the one that release left behind would pass. The reduce at
  `release-capacity.use-case.ts:100` is correct for several preceding releases; nothing proves
  it. One more release before the repeat, with a different `heldAfter`, would close the gap.
- [major] [standards] `wiki/spec/glossary.md`: `releasedInvoiceAmount` has no glossary entry. It
  is a new domain word in the domain, the DTO, the API and a column. `CLAUDE.md §2` makes that a
  review finding, and the slice's own definition of done required the entry from `/spec` before
  `/review`.
- [major] [spec] `wiki/spec/glossary.md:241` to `:253`: C2 carried from S-04 is still open. The
  `Adapter`, `Seam` and `Fake` entries still illustrate themselves with `RateProvider`,
  `ConfigRateProvider` and "a config-file rate table", which A-02 decided against and which do
  not exist. The slice's definition of done says C2 is closed before `/review` so review does
  not find it again. Review found it again.
- [major] [spec] `api/prisma/migrations/20260923120000_releases/migration.sql:17`: the partial
  unique index has no test, and neither do two other supporting tests the slice named. Nothing
  in the suite exercises `UNIQUE (reservation_id, release_id) WHERE release_id IS NOT NULL`,
  nothing proves `PrismaReservationRepository.save` writes and reads back
  `released_invoice_amount` and `held`, and nothing proves `findByReservation` returns rows in
  time order, although the read model and the idempotency check both depend on that order. The
  slice lists all three under "Supporting tests expected beyond the plan". The index is also
  invisible to `schema.prisma`, so drift detection cannot see it either: if the migration were
  wrong or the index were dropped, the gate would stay green.
- [minor] [spec] `api/src/modules/capacity/domain/reservation.ts:183`: decision 8 says `@Min(1)`
  keeps a movement that says nothing happened out of the ledger, but the minimum is in invoice
  currency. A legitimate small release whose converted value rounds to the same `held` appends a
  `release` row with `deltaHeld: 0n`: with 100 000 000 EUR left at rate `0.0067`, a release of
  one minor unit leaves `held` at 670 000. The row is not quite meaningless, since
  `releasedInvoiceAmount` moves, but the decision's stated guarantee does not hold.
- [minor] [standards] `api/src/modules/capacity/domain/program.ts:19`: the `Program` class doc
  comment ("A pot of money the treasury sets aside") is stranded above the newly inserted
  `ReleaseMovementRequest` interface, so the class it describes no longer carries it and the
  interface appears to have two doc comments.
- [minor] [standards]
  `api/src/modules/capacity/infrastructure/persistence/mappers.ts:84`: the "toFixed, not
  toString" comment now sits above `releasedInvoiceAmount`, which it does not describe. The new
  field was inserted between the comment and the `rate:` line it explains.
- [minor] [standards] `api/src/modules/capacity/domain/program.ts:132`: `Program.release` takes
  a bare `bigint` and adds it straight to `reserved`, with no check of its sign and no tie to
  the program's currency. The type change was right, but the currency association `Money`
  carried is gone at this one seam and the only remaining guard is `Money.of` refusing a
  negative result, which reaches the client as a `500`. A sign assertion, or a request typed
  against the program's currency, would keep what the type used to guarantee.
- [minor] [standards]
  `api/src/modules/capacity/application/testing/in-memory-capacity.fake.ts:45`:
  `InMemoryReservations.save` relies on the aggregate already being mutated in place, so
  deleting `await reservations.save(reservation)` from `ReleaseCapacity` would leave every unit
  test green. Only the e2e would notice.
- [minor] [spec] `wiki/spec/glossary.md:92`: "A release larger than `held` is rejected"
  contradicts ADR-0009, which judges over-release against the remaining invoice amount, not
  against `held`. The code follows the ADR; the glossary still describes the declined reading.
- [minor] [standards] `api/prisma/migrations/20260923120000_releases/migration.sql:11`:
  `released_invoice_amount` gets no CHECK, although the table already carries
  `reservations_held_within_reserved` and C1 in this very migration establishes the CHECK as the
  house pattern for exactly this class. `CHECK (released_invoice_amount BETWEEN 0 AND
  invoice_amount)` would hold in storage what `Reservation.release` holds in the domain.
- [minor] [standards] `README.md`: no release route is documented, so it shows neither a partial
  release, a full one, a repeated `releaseId` nor the reservation read. Already raised by
  `/verify` and named in the slice's definition of done; repeated here so it is not lost at
  `/ship`.

## 2026-09-24, implement S-05 (review fixes, round 1), Opus
- Seven majors and eight minors came back. The two that mattered most I reproduced before
  touching anything, rather than taking the report on trust.
- Major, an explicit `null` answered `500`. `{"releaseId":"R-1","amount":null}` passed the pipe
  untouched because `@IsOptional()` skips `null` as well as `undefined`, and the controller then
  evaluated `BigInt(null)`. This is the same trap I fixed on `rate` in S-04, documented ten
  lines above in the same file, and did not apply to the new fields. Both `amount` and `reason`
  now use `@ValidateIf` on `undefined`, red first: the new e2e case failed with
  `expected 400, got 500`.
- Major, a remainder that rounds away. Reproduced against the domain: a 1 000 000 IDR minor
  invoice at rate `0.000065` leaves `held` 0 with 1 000 IDR still owed, and the reservation was
  then unreleasable forever. The code was faithful to AC-15 and the glossary, so this went
  through `/spec` (merged as #32) and the code now follows the amended rule: status is derived
  from the remaining invoice amount, and `RESERVATION_ALREADY_RELEASED` is answered on that. Two
  domain tests cover the state, and INV-02's property test now guards its closing release on
  what the invoice has left rather than on `held`, so it walks through the case instead of
  around it. A rate of `0.000065` joined its rate list to make sure it does.
- Major, the AC-16 tests could not fail: both repeated the only release the reservation had, so
  "the original outcome" and "the state now" were the same number. A second, different release
  now runs before the repeat, in the unit test and the e2e, so R-1's `heldAfter` of 192 500 000
  is asserted while the reservation holds 137 500 000.
- Major, three promised tests were missing and are now there: `save` writing and reading back
  `released_invoice_amount`, the partial unique index refusing a repeated
  `(reservation_id, release_id)` while allowing the same id on another invoice, and
  `findByReservation` returning rows in append order with their `releaseId` and `reason`.
- Major, AC-14's contract text. Marcin decided the code is right: an unknown program answers
  `PROGRAM_NOT_FOUND`, as it does on reserve (AC-04), and only an unknown invoice on a known
  program answers `RESERVATION_NOT_FOUND`. The OpenAPI description said otherwise and now says
  what the code does, naming both criteria.
- Majors for the two glossary entries closed in #32: `releasedInvoiceAmount` has its entry, and
  C2 carried from S-04 is gone.
- Minors taken: the stranded `Program` class comment and the detached `toFixed` comment are back
  above what they describe; `Program.release` refuses a delta that does not lower `held` and one
  that would take `reserved` below zero, rather than letting a broken caller reach `Money.of`
  and become a `500`; the migration gained `CHECK (released_invoice_amount >= 0 AND <=
  invoice_amount)`, which the sibling column already had.
- Minors left, and why: the in-memory `save` fake cannot fail, which is true of every fake we
  have and is a testing-strategy question rather than this slice's; a legitimate very small
  release can still append a `deltaHeld` of zero, which is a real wrinkle in decision 8 but
  changes no balance and no invariant; the glossary's "larger than `held`" line predates
  ADR-0009 and is `/spec` work; the README is `/ship`'s.
- `npm run gate` green: unit 131, integration 29, e2e 52, cold start 3. Nothing committed.

## 2026-09-24, verify S-05 (second pass, after review round 1), Sonnet
- `npm run gate` green on 079107a: prose clean, unit 131/131, integration 29/29, e2e 52/52,
  cold start 3/3. Coverage 12/12 at the planned level, no skipped or focused tests, layer
  boundaries hold.
- The gate being green is not the whole story. **FAIL**, on a regression the fix round
  introduced and no test covers.
- The cold start could not run on the default port: port 3000 is held by a process from
  Marcin's other project (`agentic-emr`, started 14:45 today), which I left alone. Ran with the
  `API_PORT` override the README documents, so the check itself still happened.
- Two of the three round 1 fixes are confirmed live: an explicit `"amount": null` now answers
  `400` where it answered `500`, and an IDR invoice at rate `0.000065` released down to a
  remainder now reads `held` 0 with status **active**, which is the amended AC-15 working.
- The third is broken by the second. Releasing that remainder answers
  `500 INTERNAL_ERROR`. `Reservation.release` returns `deltaHeld` 0 for it, because `held` had
  already rounded to zero and stays there, and the guard I added to `Program.release` in the
  same round refuses any delta that is not negative. So the minor fix blocks the path the major
  fix exists to open. The guard should refuse a delta that raises `held`, not one that leaves it
  where it is.
- Why no test caught it: the two new domain tests call `Reservation.release` directly, and no
  test walks a rounded-away remainder through `ReleaseCapacity` and `Program`. A use case level
  test and an e2e for that path are owed with the fix.
- Result: FAIL. Back to `/implement`.

## 2026-09-24, implement S-05 (review fixes, round 2), Opus
- Fixes the regression the previous round introduced and verify caught live. The guard I added
  to `Program.release` refused any delta that was not negative, but closing a remainder whose
  `held` has already rounded to zero produces a delta of exactly zero, so the minor fix blocked
  the path the major fix exists to open. The guard now refuses only a delta that raises `held`,
  which is the broken caller it was meant to catch; zero is legitimate and the ledger records
  the repayment with no capacity moving.
- Two tests close the hole that let this through. The round 1 tests called `Reservation.release`
  directly, so nothing walked a rounded-away remainder through `ReleaseCapacity` and `Program`.
  There is now a use case test for that path, red first with
  `RangeError: Release R-2 does not lower held: 0`, and an e2e that reserves an IDR invoice at
  `0.000065`, releases all but the remainder, sees `held` 0 with status `active`, closes it, and
  asserts the three movements read `reserve 65`, `release -65`, `release 0`.
- `npm run gate` green: unit 132, integration 29, e2e 53, cold start 3. Nothing committed.

## 2026-09-24, verify S-05 (third pass, after review fixes round 2), Sonnet
- `npm run gate` green on 2026dc3: prose clean, unit 132/132, integration 29/29, e2e 53/53,
  cold start 3/3. Coverage 12/12 at the planned level, no skipped or focused tests, layer
  boundaries hold.
- The regression the second pass found is gone, and I checked the whole path live rather than
  only the one call that failed: an IDR invoice at `0.000065` releases all but its remainder
  (`held` 0, status `active`), then closes (`held` 0, `releasedInvoiceAmount` 1 000 000, status
  `closed`, where the previous pass answered `500`), and a further release then answers
  `RESERVATION_ALREADY_RELEASED`, which is the amended AC-15 doing exactly what it should at
  both ends. An explicit `"amount": null` still answers `400`.
- Cold start again used the `API_PORT` override: port 3000 is still held by a process from
  Marcin's other project, now pid 78243. Left alone.
- Result: PASS.

## 2026-09-24, review S-05 (round 2, after fix rounds 1 and 2), Opus
- Fresh context review of `49c34c0..HEAD` (implementation `ef43a7f` plus fix commits `079107a`
  and `2026dc3`), against `CLAUDE.md` and against AC-10 to AC-19, AC-34, INV-02, A-02, A-08,
  A-09, A-10, ADR-0006, ADR-0008, ADR-0009 and the slice's ten local decisions.
- Model independence still did not hold, at any point of this slice. `CLAUDE.md §8` puts a
  `risk: high` slice on Fable for `/implement` and on Fable in a fresh context for `/review`.
  The Fable credits are exhausted, so the implementation, review round 1 and this round all ran
  on Opus. The context was fresh each time, the model never was, so a shared blind spot would
  have survived every pass. Recorded plainly rather than glossed.
- All seven majors from round 1 are genuinely closed in the code, not only in the commit
  message. `amount` and `reason` use `@ValidateIf` on `undefined` and six malformed bodies are
  refused with `400` in the e2e; the OpenAPI text on the release route names both `404` codes;
  the rounded away remainder now derives `status` from `remainingInvoiceAmount` and is walked
  end to end by a domain test, a use case test and an e2e that asserts the three movements read
  `reserve 65`, `release -65`, `release 0`; the AC-16 tests now run a second, different release
  before the repeat, so `heldAfter` 192 500 000 is asserted while the reservation holds
  137 500 000, which is the discrimination the old tests lacked; the glossary has its
  `releasedInvoiceAmount` entry and C2's `RateProvider` illustrations are gone; and the three
  promised supporting tests exist (save round trip, the partial unique index refusing a repeat
  while allowing the same id on another invoice, `findByReservation` returning both rows).
- The round 2 regression is fixed at the root, not papered over. `Program.release` now refuses
  only a delta that raises `held`, a delta of zero is legitimate, and the ledger chain, INV-02
  and INV-03 all hold for a zero delta row (checked against `Ledger.recompute` and the
  `afterEach` helper, which sums `held` of active reservations and so is unaffected by a
  reservation that is active while holding nothing).
- Concurrency re-checked on the write path and it holds: both writers take the program row lock
  first (ADR-0008), so a duplicate `releaseId` cannot race past the in transaction check into
  the partial unique index, and `reserved` and `held` move in one transaction. The read path is
  where it does not hold, which is the first major below.
- Judgement on the three minors round 1 left deliberately, as asked. The in memory `save` fake
  is defensible, though not for the reason given: "true of every fake we have" is the weaker
  half, the real cover is that AC-16 and AC-19 re-read the reservation over HTTP after a release
  and the new integration test round trips `released_invoice_amount`, so a dropped `save` fails
  the suite. The zero delta row is more than defensible, it is now required: the amended AC-15
  path produces exactly such a row and an e2e asserts it; what is left wrong is decision 8's
  text in the slice file, which still calls it a row that says nothing happened (minor below).
  The glossary's "larger than `held`" line is defensible only as far as `/ship`: it is the
  ubiquitous language contradicting an accepted ADR in the very area this slice implements, and
  a `/spec` pass ran on this exact file during this slice (#32), so "it is `/spec` work" did not
  in fact block it. `CLAUDE.md §9` wants the wiki true before the slice is done.
- REVIEW S-05: 10 findings (0 blockers / 2 majors / 8 minors). Not a pass, though both majors
  are small: one query moved inside a transaction and four sentences that still state the
  superseded status rule.

Findings, most severe first:

- [major] [spec] `api/src/modules/capacity/application/get-reservation.query.ts:25` and `:27`:
  the reservation read is two unsynchronised queries, so AC-19 can answer a body that
  contradicts itself. `findByInvoice` and `findByReservation` run outside any transaction; a
  release committing between them returns the reservation as it was together with the movement
  that has already changed it, so the movements no longer sum to the `held` on the same body.
  The repo's own standard says otherwise in as many words: `api/test/support/ledger-invariants.ts:33`
  takes a repeatable read transaction for exactly these three reads "so a writer running at the
  same time cannot split the view between them". The production read model, which S-07's page
  renders directly, does not. `UnitOfWork.run` is already injected everywhere else for this.
- [major] [spec] The AC-15 amendment is stated in one place and contradicted in four, two of
  them published to clients.
  `api/src/modules/capacity/infrastructure/http/reservation.dto.ts:119` publishes the status
  property as "active while held > 0", which is the exact rule the amendment replaced and the
  only description of it a client of the OpenAPI document sees;
  `api/src/modules/capacity/domain/errors.ts:113` renders the client visible message "holds
  nothing: it has already been released", when the reason is now that the whole invoice has
  been released and a reservation can hold nothing without being released;
  `api/src/modules/capacity/domain/errors.ts:107` and
  `api/src/modules/capacity/domain/reservation.ts:9` ("Derived from `held`, never stored") and
  `api/prisma/schema.prisma:39` ("`status` is derived from `held` and never stored") say the
  same superseded thing in comments. The behaviour is right everywhere; the words a reader
  meets first are wrong.
- [minor] [spec] `api/test/releases.e2e-test.ts:201`: the round 1 major about AC-14 is closed in
  the contract text and in the work-log, but not in the spec. AC-14's Then clause still reads
  `404 RESERVATION_NOT_FOUND`, the slice's own test row still puts the unknown program under
  AC-14 "as the same criterion", and a test tagged `[AC-14]` now asserts `PROGRAM_NOT_FOUND` for
  it. Marcin's decision is sound and consistent with AC-04, but `CLAUDE.md §7` wants it as a
  `## Changes` row or an assumption, and the slice row corrected, not only as a line in a log.
- [minor] [standards] `api/src/modules/capacity/domain/reservation.ts:176`: `release` reads only
  `request.amount`. `releaseId`, `reason` and `clientId` are accepted and ignored, which is dead
  weight and a small trap: the movement's id and reason come from the use case's own copy at
  `release-capacity.use-case.ts:75`, so nothing makes the pair agree and a caller passing
  different values to the two calls would be silently obeyed.
- [minor] [standards] `api/prisma/schema.prisma:92` and
  `api/src/modules/capacity/infrastructure/persistence/mappers.ts:58`: `reason` is a free
  `VarChar(16)` with no enum and no CHECK, while `kind` and `source`, the two other closed
  vocabularies, are Postgres enums; the mapper then asserts the column into the domain type with
  a bare `row.reason as ReleaseReason`. Any value that reaches the column from outside the
  service flows into the domain and out to clients as a `ReleaseReason`. Nothing constrains a
  `release` row to carry a `release_id` and a `reason` either, which is what makes the new
  partial unique index meaningful.
- [minor] [standards]
  `api/src/modules/capacity/infrastructure/persistence/prisma-capacity.integration-test.ts`, the
  ordering case added in round 1: it cannot fail on ordering. The two rows are appended in the
  order asserted and Postgres returns a small fresh table in insertion order, so deleting
  `orderBy: {id: 'asc'}` from `PrismaLedgerRepository.findByReservation` leaves it green. The
  prefix sum in `release-capacity.use-case.ts:100` depends on that order for AC-16's `heldAfter`.
- [minor] [spec] `api/test/releases.e2e-test.ts:316`: AC-18 names six fields and slice decision
  10 exists so the criterion is not asserted weakly, but only the read after the reserve checks
  all six (`toEqual` at line 307); the read after the release checks `reserved` and `available`
  with `toMatchObject`, which is the half of the criterion the slice is actually about.
- [minor] [spec] `wiki/slices/S-05-releases.md:138`, decision 8: it says a zero release is
  refused because such a row "says nothing happened", and the shipped code now appends exactly
  that row on the amended AC-15 path and asserts it in an e2e. The decision's rationale is
  superseded by the amendment and the slice file still states it.
- [minor] [standards] `api/src/modules/capacity/domain/program.ts:132`: `Program.release` still
  takes a bare `bigint` with no tie to the program's currency. The round 1 guards document the
  sign, not the currency. No reachable defect today: ADR-0007 refuses a re-denomination while
  anything is held, and a reservation whose `held` rounded away always produces a delta of zero,
  so no cross currency arithmetic can happen. That reasoning is the guarantee now, and it is
  written down nowhere.
- [minor] [standards] `README.md:72` and `:99`: still no release route, no reservation read and
  none of the four new codes in the error table, and the reserve paragraph still says "cross
  currency arrives in S-04" two lines above the cross currency example. `/verify` and review
  round 1 both raised the missing routes; repeated so `/ship` does not lose it.

## 2026-09-24, implement S-05 (review fixes, round 3), Opus
- Review round 2 confirmed all seven round 1 majors closed in the code, and found two more.
- Major, the reservation read was two unsynchronised queries. `GetReservation` read the
  reservation and then its movements outside any transaction, so a release committing between
  them would answer AC-19 with a body whose movements do not sum to the `held` printed beside
  them. It now runs both reads inside `UnitOfWork.run`, which is the rule the ledger invariant
  helper states for its own reads and which S-07's page will depend on. The two standalone read
  providers and their tokens are gone with it, since nothing else used them.
- Major, the AC-15 amendment was stated once and contradicted in four places, two of them
  published: the OpenAPI status description still said "active while held > 0", and the `409`
  message still said the reservation "holds nothing". Both now say what the rule is. The type
  comment and the schema comment followed.
- Minors taken. `ReleaseRequest` carried `releaseId`, `reason` and `clientId` that the entity
  never read, a second copy of what the use case already passes to `Program.release` with
  nothing keeping the two equal; it now takes the amount alone. `capacity_movements.reason` was
  a free `VarChar(16)` while `kind` and `source` are enums, so the mapper cast whatever it
  found: there is now a CHECK, and the mapper refuses an unknown value instead of casting. The
  ordering integration test appended newest first, so it can now fail on ordering rather than
  passing on Postgres's habit of returning a small fresh table in insertion order. AC-18's
  second read asserts all six fields, as the criterion names them. Slice decision 8's text said
  a zero delta row says nothing happened, which the amended AC-15 makes false, and the AC-14
  test row said the opposite of what Marcin decided; both corrected.
- One correction of my own process: I first fixed the glossary's "larger than `held`" line on
  this branch, which `/implement` may not do, and took it back out. It goes through its own docs
  PR like #32 did.
- `npm run gate` green: unit 132, integration 29, e2e 53, cold start 3.

## 2026-09-24, verify S-05 (fourth pass, after review fixes round 3), Sonnet
- `npm run gate` green on the rebased branch: prose clean, unit 132/132, integration 29/29,
  e2e 53/53, cold start 3/3. Coverage 12/12 at the planned level, no skipped or focused tests,
  layer boundaries hold.
- Both round 2 majors confirmed fixed against behaviour on a cold started stack, not only in the
  diff. The AC-19 read now answers a body whose movements sum to the `held` printed beside them
  (`reserve` 302 500 000 and `release` -110 000 000 against `held` 192 500 000), which is the
  one-transaction read doing its job. The published status description now reads "active until
  the whole invoice has been released; `held` may already be 0 (AC-15)", the amended rule rather
  than the one it replaced.
- The new `reason` constraint works end to end: an unknown reason answers `400`.
- Cold start again on the `API_PORT` override, port 3000 still held by Marcin's other project.
- Result: PASS.

## 2026-09-24, review S-05 (round 3), Opus
- REVIEW S-05: 8 findings (0 blockers / 3 majors / 5 minors). Ran on Opus again, for the same
  reason as every other pass of this slice: the Fable credits are exhausted. Implementation and
  all three reviews have now run on one model, so the model independence `CLAUDE.md §8` asks for
  has not held at any point of S-05, and a shared blind spot would have survived every pass.
- Round 2's second major is genuinely closed. The amended AC-15 rule is stated consistently in
  the OpenAPI `status` description, the `RESERVATION_ALREADY_RELEASED` message, the domain type
  comment and the schema comment, and the glossary entry landed in PR #33.
- Round 2's first major is not closed. `GetReservation` now runs both reads inside
  `UnitOfWork.run`, but `PrismaUnitOfWork` opens the transaction with `{timeout}` alone, so it
  runs at PostgreSQL's default read committed, where every statement takes its own snapshot. One
  transaction is not one snapshot: a release committing between the two statements is still
  invisible to the first and visible to the second. The precedent the fix cites in its own
  comment, the ledger invariant helper, passes `{isolationLevel: 'RepeatableRead'}` for exactly
  this reason.
- Two majors nobody has looked at in three rounds: the assumptions register. AC-15 was amended
  and given its Changes row, but A-09 still says a new `releaseId` on a reservation with
  `held = 0` is a `409`, which is now false, and A-08 still says a release is judged against the
  remaining `held` rather than against what the invoice has left. Both are assumptions AC-15 and
  AC-13 reference by id, both contradict shipped behaviour, and neither has a Changes row.
- Checked and clean: trimming `ReleaseRequest` to the amount alone strands nothing (the type has
  two references, both in `reservation.ts`) and removes no behaviour, since the three dropped
  fields were only ever read by `Program.release` from the command; no orphan repository token
  survives (`PROGRAM_REPOSITORY` is the only one left and predates this slice); the new
  `capacity_movements_reason_known` CHECK agrees exactly with what the domain can produce
  (`ReleaseReason` is `repaid | cancelled`, null on every other kind); and moving `GetReservation`
  into a transaction changed nothing it can throw, since Prisma rolls back and rethrows the
  domain error unchanged.
- INV-02 under two parallel requests: the critical section is the program row lock taken by
  `lockById` (`FOR UPDATE`) before the reservation is read, so two releases on one reservation
  serialise and the second reads the first's committed `released_invoice_amount`. The partial
  unique index on `(reservation_id, release_id)` and the `reservations_released_within_invoice`
  CHECK are the backstop under the lock. The invariant holds.
- Full list of findings, most severe first:
- [major] [spec] `api/src/modules/capacity/infrastructure/persistence/prisma-unit-of-work.ts:26`
  and `api/src/modules/capacity/application/get-reservation.query.ts:18`: the transaction is
  opened with no `isolationLevel`, so it is read committed and each statement re-snapshots. The
  two reads of `GetReservation` can still disagree, so AC-19 can answer a body whose movements do
  not sum to the `held` printed beside them. The comment claims parity with
  `api/test/support/ledger-invariants.ts:59`, which is repeatable read. Round 2's major is not
  closed; the write paths are unaffected because they lock the program row first.
- [major] [spec] `wiki/spec/assumptions.md:260` (A-09): "a new `releaseId` on a reservation with
  `held = 0` is `409 RESERVATION_ALREADY_RELEASED`". The service answers `200` for exactly that
  case when the invoice still owes (`reservation.ts:153`, `releases.e2e-test.ts:217`). AC-15's
  amendment was never carried to the assumption AC-15 and AC-16 both reference, and the
  assumptions `## Changes` table has no row for it. `/spec` work, as C2 was.
- [major] [spec] `wiki/spec/assumptions.md:236` and `:240` (A-08): "Several releases may follow
  until `held` is zero" and "A release larger than the remaining `held` is
  `422 RELEASE_EXCEEDS_HELD`". The code judges against the remaining invoice amount
  (`reservation.ts:179`), which is ADR-0009 and what the glossary was corrected to say in PR #33.
  The register still states the superseded rule and has no Changes row.
- [minor] [standards] `api/src/modules/capacity/domain/reservation.test.ts:54` and `:201`,
  `api/src/modules/capacity/application/release-capacity.use-case.test.ts:156`, and
  `wiki/slices/S-05-releases.md:56`: four more statements of the rule the AC-15 amendment
  removed, in test names and in the slice's own Scope ("once nothing is held", "holds nothing",
  "`held.isZero()` before the call throws `ReservationAlreadyReleased`"). Round 2 found four and
  fixed four; these are the ones it did not reach, and `reservation.test.ts:201` sits directly
  above the sibling at `:240` that proves the opposite.
- [minor] [standards] `api/prisma/migrations/20260923120000_releases/migration.sql`: the
  migration was edited in 78240f2 after being created and applied in 2e6eabc. `prisma migrate
  deploy` (`api/package.json:22`) refuses a migration whose checksum changed after it was
  applied, so any database that ran this branch before the fix round now fails to migrate.
  Testcontainers and the cold start always start empty, so no gate can see it.
- [minor] [standards] `api/prisma/migrations/20260923120000_releases/migration.sql:27`: the new
  `capacity_movements_reason_known` CHECK has no test, and neither has
  `reservations_released_within_invoice`, while their sibling `reservations_rate_positive` does
  (`prisma-capacity.integration-test.ts:272`). A constraint that wrongly excluded `cancelled`
  would fail the AC-17 e2e, but one that is too permissive, or a `toReleaseReason`
  (`mappers.ts:54`) that stops refusing, would not.
- [minor] [spec] `api/src/modules/capacity/application/get-reservation.query.ts:25`: a `GET` of a
  reservation on a program the treasury never announced answers `RESERVATION_NOT_FOUND`, while a
  `POST` of a release on the same unknown program answers `PROGRAM_NOT_FOUND`, which
  `programs.controller.ts:85` publishes as the rule. The query never loads the program, so
  Marcin's AC-14 decision of 2026-09-24 was not carried to the read. Both are `404` and AC-19 is
  silent, so nothing on the wire is wrong.
- [minor] [standards] `api/test/releases.e2e-test.ts:166`: the `[AC-13]` test asserts that
  availability did not move but not the "no movement appended" its row in the slice file names
  (`wiki/slices/S-05-releases.md:159`). A `release` row with `deltaHeld` 0 would pass both the
  assertion and the `afterEach` ledger invariants, so the criterion is proved one notch weaker
  than it is written. AC-16's test already does the stronger thing at `:292`.

## 2026-09-24, implement S-05 (review fixes, round 4), Opus
- Review round 3 found that my round 2 fix did not actually fix anything. I had moved AC-19's
  two reads into one transaction, but `PrismaUnitOfWork.run` passes only a timeout, so the
  transaction runs at read committed, where every statement takes its own snapshot. One
  transaction is not one instant. The review quoted my own comment, which cited the ledger
  invariant helper as precedent, and that helper sets `RepeatableRead` for exactly this reason.
- Fixed without disturbing the write path, which is the part that needed care: the port gains
  `readSnapshot`, a second door that runs at `RepeatableRead`, while `run` stays at read
  committed on purpose. Raising the write path to repeatable read would make
  `SELECT ... FOR UPDATE` fail to serialise instead of blocking, and INV-01's parallel
  reservations would start answering errors rather than queueing.
- The test proves the property rather than the setting: inside a `readSnapshot`, a committed
  write from another connection lands between two reads and is not seen, while the row really
  did change. Checked that it can fail by running the same body through `run`, where it reports
  `1n` against the expected `100000000n`.
- Two majors were in the assumptions register, which three rounds of review and four of mine
  never opened. A-08 still said releases run "until `held` is zero" and that over-release is
  judged against the remaining `held`; A-09 still said a new `releaseId` on a reservation with
  `held = 0` is `409`. Both are `/spec` work and go in their own PR; the code already does what
  ADR-0009 and the amended AC-15 say.
- Minors taken. The two constraints I had added by editing an already-applied migration are now
  a migration of their own: editing one changes its checksum, and `prisma migrate deploy` then
  refuses the whole database, which no gate can see because every test database starts empty.
  The `releases` migration is back to the byte it was applied as, checked against its creating
  commit. Both constraints now have tests. `GetReservation` answers `PROGRAM_NOT_FOUND` for an
  unannounced program, as the release route does and as the controller publishes, instead of
  telling a client two different things about one state. AC-13 asserts that a refused release
  appends no movement, which its slice row always claimed. Four more statements of the removed
  AC-15 rule, in test names and the slice's Scope, now say the rule that holds.
- `npm run gate` green: unit 132, integration 32, e2e 53, cold start 3.

## 2026-09-25, verify S-05 (fifth pass, after review fixes round 4), Sonnet
- `npm run gate` green on the rebased branch: prose clean, unit 132/132, integration 32/32,
  e2e 53/53, cold start 3/3. Coverage 12/12 at the planned level, no skipped or focused tests.
- Swept the whole tree for statements of the rule AC-15 replaced, in `api/src`, `wiki/spec` and
  the slice file: none left. That sweep is what the last three rounds kept finding one more of,
  so it is worth doing as a check rather than as a fix.
- Both round 3 majors confirmed live on a cold started stack: AC-19's movements sum exactly to
  the `held` on the same body, and the release route and the read route now answer the same code
  for the same state (`PROGRAM_NOT_FOUND` for an unannounced program), rather than telling a
  client two different things.
- A-08 and A-09 landed in #34, so the register, the glossary and the criteria now agree with
  ADR-0009 and with each other.
- Result: PASS.

## 2026-09-25, review S-05 (round 4), Opus
- Ran on Opus again, for the same reason as every other pass of this slice: the Fable credits
  are exhausted. Four rounds of review and five of implementation have now all run on one model,
  so a shared blind spot has had nothing to catch it.
- REVIEW S-05: 6 findings (0 blockers / 1 major / 5 minors).
- Round 3's three majors are genuinely closed. `readSnapshot` runs at `RepeatableRead` and `run`
  stays at read committed, which is the right split: the write path keeps blocking on
  `SELECT ... FOR UPDATE` (INV-01) and the read path gets one instant. The integration case at
  `prisma-capacity.integration-test.ts:374` proves the property rather than the setting, with a
  committed write from another connection landing between two reads inside the snapshot, and it
  checks that the write really happened so it cannot pass for the wrong reason. A-08 and A-09 in
  the assumptions register now state the rules ADR-0009 and the amended AC-15 actually hold, with
  their Changes rows.
- Asked of the newest code specifically. `readSnapshot` cannot deadlock or fail to serialise:
  it takes no lock and writes nothing, and a read-only `RepeatableRead` transaction in Postgres
  has no conflict to lose. The migration split is sound: `20260923120000_releases` is byte
  identical to its creating commit (checked against de6e10f) and `20260924120000_release_constraints`
  adds only CHECK constraints, which the Prisma schema cannot express in either file, so schema
  and migrations still agree and both apply in order on an empty database. The extra
  `programs.findById` in `GetReservation` is one primary key lookup inside the same snapshot and
  introduces no new failure: it can answer `PROGRAM_NOT_FOUND` (404) or the mapper errors every
  other program read already carries.
- The major is the shape the last round found, one file further out. The AC-15 amendment of
  2026-09-24 changed what `closed` means, and AC-27 in the criteria still reads `held` 0 and
  status closed as one statement. With `status` derived from the remaining invoice amount they
  are now two, and nothing records how a reconciliation adjustment is meant to reach the second.
  The criteria carry a Changes row for AC-15 and none for AC-27, and this slice's hand-off note
  to S-06 talks about `releasedInvoiceAmount` on snapshot created reservations but not about a
  snapshot closing one that exists. It is `/spec` work, like A-08 and A-09 were, not a defect in
  the code.
- Minors: the read route publishes only `RESERVATION_NOT_FOUND` on its 404 although the round 3
  fix deliberately made it answer `PROGRAM_NOT_FOUND` too, and the work-log entry for that fix
  claims the controller publishes it; the mapper's comment still points at the `releases`
  migration for a constraint that now lives in `release_constraints`; the in-memory unit of work
  claims a rollback it does not perform on aggregate state, which matters from this slice on
  because `ReleaseCapacity` is the first use case to mutate a loaded aggregate; `readSnapshot`
  hands out the full write repositories, which is the one way the isolation split could be
  turned back into the bug it was created to remove; and the INV-02 property test catches
  over-release attempts without ever asserting that any occurred.
- No code defect was found in the release path itself. The critical section for INV-02 and INV-03
  is the program row lock, taken before the reservation and the ledger are read, and a release
  only lowers `reserved`, so two parallel releases on one program are ordered and neither can
  double apply: the duplicate check reads the same ledger rows behind that lock, with the partial
  unique index as the backstop.

## 2026-09-25, implement S-05 (review fixes, round 5), Opus
- Review round 4 passed the code and would not send anything back to `/implement`; its one major
  is AC-27, a requirement of S-06 whose meaning our own AC-15 amendment changed. That is `/spec`
  work and goes in its own PR. Marcin decided it: a reconciliation adjustment that drops a
  reservation also takes `releasedInvoiceAmount` to the whole invoice, so `held` 0 and status
  closed coincide again, which is what a snapshot saying "this reservation is gone" means.
- The five minors are closed here. The read route publishes both codes it can answer, not just
  one. The `toReleaseReason` comment cites `release_constraints`, which is where the CHECK
  actually went after the migration split. The in-memory `run` no longer claims to be a
  rollback: it restores the collections but hands back the same aggregates, and S-05 is the
  first slice whose use case mutates a loaded one in place, so a "wrote nothing" assertion
  against the fake is weaker than the same assertion against the database, and the comment now
  says so.
- `readSnapshot` is narrowed to a `CapacityReads` of exactly the three reads it needs, instead of
  taking the full repositories and warning in prose that the write path must not run there. The
  type now prevents what the comment used to ask for.
- INV-02's property test asserts it reached the boundary at all: over-release and
  already-released outcomes are counted, and the test fails if the random amounts stop ever
  asking for too much. Without it the suite could quietly cover less and stay green, which is
  the same defect class as the AC-16 tests round 1 found.
- `npm run gate` green: unit 132, integration 32, e2e 53, cold start 3.

## 2026-09-25, ship S-05, Sonnet
- Precondition with one caveat, stated rather than glossed. `CLAUDE.md` wants the latest review
  to have zero majors; review round 4 had one, AC-27, and that major is fixed and merged in #35
  rather than closed by a fifth review round. Marcin decided to ship on that basis: the round 4
  report says in as many words that the code would pass and that nothing in `api/`, `api/test/`
  or the migrations would go back to `/implement`, and the one finding was a requirement of
  S-06 whose meaning this slice's own AC-15 amendment changed.
- `wiki/plan/plan.md`: the twelve S-05 rows are `done` with their test files, and eight `extra`
  rows cover the supporting tests, including the three storage constraints and the snapshot
  read. Commit column waits for the merge commit.
- README gains the release route, the full release, the repeated `releaseId` and the reservation
  read, plus the four new codes, and loses the stale line saying cross-currency arrives in S-04.
  Every new example run literally on a fresh stack: the partial release left `held` 192 500 000
  and status `active`, the full one 0 and `closed`, the repeat answered
  `RELEASE_ALREADY_PROCESSED` with `heldAfter` 192 500 000, and the read showed the three
  movements.
- ADR-0009 was accepted before the slice; no ADR to finalise. No assumption is missing from the
  register: A-08 and A-09 were amended in #34 during the slice.
- Changelog row, slice status `done`, slice index and Home updated; Home names S-06 next and
  records that ADR-0010 and ADR-0011 are both still `proposed`, and that ADR-0011 now also owes
  the rule S-05 put on it.
- Four review rounds, 39 findings. Worth carrying forward rather than filing away: two of them
  were ordinary client input answering `500`, one was a regression a fix round introduced that
  only a live check caught, and the last three majors were in the wiki rather than the code. No
  round had the model independence `CLAUDE.md §8` asks for, because the Fable credits were
  exhausted from the second round of S-04 onwards.

## 2026-09-25, plan S-06 (revision before implement), Opus
- Targeted run for a slice that already existed: S-06 was written on 2026-09-19, before releases
  existed. S-05 shipped today, so the file was reconciled with the shipped code rather than
  rewritten. The nine requirement rows in `wiki/plan/plan.md` are untouched: all nine test names
  still match the slice file, checked name by name, and the levels are unchanged. The slice index
  is unchanged too.
- The first version would have been wrong in three places, all caused by ADR-0009 and none
  visible before S-05. A correction written only to `held` is undone by the next release, because
  a release derives `held` from the remaining invoice. A listed reservation compared with its
  current `held` would undo a release the client was told succeeded after `asOf`. And an invoice
  that one snapshot drops and a later one lists again has no rule, which breaks INV-07: reversed
  delivery ends active, in-order delivery ends closed. These are one decision with three
  questions, drafted as ADR-0012 (proposed), recommendation: a stored signed correction, a
  comparison as of `asOf`, and a reopen unless the client closed the reservation after `asOf`.
- ADR-0010's recommendation is revised, not decided. Option 3's "listed wins" would correct a
  listed reservation created after `asOf`, which INV-06 forbids in as many words, so Option 2
  is recommended instead. The clock is the shipped `Clock` port rather than the database clock,
  because the e2e app can override it and the tests can then use the criteria's own times. The
  first text's claim that AC-28 sits on the window boundary was wrong: the window is before
  `asOf` and AC-28's reservation is after it.
- ADR-0011 gains an addendum: a reservation born from a snapshot has `createdAt` equal to the
  snapshot's `asOf`. With our processing time instead, a queued message would make a later
  snapshot keep an invoice the treasury has dropped.
- Checked against the code rather than assumed: the `reconciliation` source value, `programs.as_of`,
  the `adjustment` kind and a movement's `messageId` all exist already, and the availability
  mapper already returns `asOf`. What is new is the consumer's dispatch by `type`, two repository
  reads (a program's active reservations, its client movements after a moment), one column if
  ADR-0012 is accepted as recommended, and a settable clock in the e2e harness.
- Thirteen local decisions recorded for review to hold the code to, among them that a snapshot is
  stale only when strictly older (A-12's word, and what `setLimit` already does), that the limit
  inside a snapshot is judged as a fact of its own (INV-07), that a listed `held` of 0 is legal,
  and that INV-07 compares state rather than history.
- Owed to `/spec` once the ADRs are decided: A-12 wording for the window, the comparison as of
  `asOf` and the reopen rule; the glossary's `Held`, `Adjustment` and `Snapshot moment` entries,
  and an entry for the correction field.
- Branch `docs/plan-S-06` cut from `main` at c206c30. Files: the S-06 slice file, ADR-0012 (new),
  ADR-0010 and ADR-0011 (recommendation revised, addendum), the decisions index, `Home.md`, this
  entry. `wiki/plan/plan.md` and the slice index needed no change. Nothing committed.

## 2026-09-25, plan S-06 (ADR decisions), Opus
- Marcin accepted ADR-0010, ADR-0011 and ADR-0012 as recommended, on the plan branch before its PR
  was opened. ADR-0010: Option 2, a 30 s keep window before `asOf` for omitted reservations,
  nothing created at or after `asOf` touched, `createdAt` from the `Clock` port. ADR-0011:
  Option 1, a snapshot-born reservation has `invoiceAmount` equal to the listed `heldAmount`,
  program currency, rate 1 and `createdAt` equal to `asOf`. ADR-0012: 1A, 2A, 3A, a stored signed
  `heldCorrection`, a listed reservation compared as of `asOf`, a reopen unless the client closed
  it after `asOf`.
- The slice file loses its "if decided as recommended" conditions: the migration, the keep window
  setting and the supporting tests are now plain scope. Decisions index and Home updated.
- Still owed to `/spec` before `/review`: A-12 wording for the window, the comparison as of `asOf`
  and the reopen rule, and glossary entries for `Held`, `Adjustment`, `Snapshot moment` and
  `heldCorrection`, each with a Changes row.

## 2026-09-25, spec (revision: S-06 reconciliation wording), Opus
- Revision run with no new source: the wording ADR-0010, ADR-0011 and ADR-0012 owed to the spec
  after they were accepted in the S-06 plan PR (#37). No question was open; each rule below was
  decided by Marcin in those ADRs, so nothing was assumed here.
- A-12 amended, with a Changes row: a 30 s keep window before `asOf` for omitted reservations,
  the shape and `createdAt` of a snapshot-created reservation, a listed reservation compared as of
  `asOf` so a client's later release stands (worked example with numbers), and a reopen of a
  listed reservation closed at or before `asOf`.
- Glossary: `Held` now names the correction and says the ledger recomputes it from releases and
  adjustments, not releases alone; the reservation table's `held` row admits an adjustment in
  either direction; active and closed mention that a snapshot closes and reopens; `Adjustment`
  carries ADR-0011's sentence and an example; `Snapshot moment` states the window and the as of
  comparison. Two new entries, `Held correction (heldCorrection)` with the AC-29 numbers and
  `Keep window` with a 17:59:45 against 17:59:00 example, since both words will be in code.
- Cross-check found a gap, recorded here rather than resolved: the keep window, the comparison
  as of `asOf` and the reopen are now requirements in A-12 but have no AC or INV, only the
  untagged supporting tests the S-06 plan names. `CLAUDE.md §4` says a test that is the only proof
  of a requirement is not supporting. Put to Marcin: add three ACs (then a targeted `/plan` adds
  their rows to S-06), or keep them as supporting tests on purpose.
- Branch `docs/s-06-reconciliation-wording` from `main` at 3d6102c. Files: `assumptions.md`,
  `glossary.md`, this entry. Nothing committed.

## 2026-09-25, spec (revision: AC-42 to AC-44), Opus
- Marcin answered the gap the previous entry put to him: the three A-12 rules get acceptance
  criteria. AC-42, the keep window: a reservation created at 17:59:45 is kept by an 18:00:00
  snapshot that omits it. AC-43, a release after `asOf` stands: 1 925 000 held, 500 000 released
  at 18:05, an 18:00 snapshot listing 1 900 000 leaves 1 400 000 with an adjustment of minus
  25 000. AC-44, a reopen: an invoice omitted at 12:00 and listed at 300 000 at 18:00 is active
  again with `held` 300 000. Changes row added.
- The case where a client's full release after `asOf` keeps a listed reservation closed is AC-43's
  rule applied to a whole invoice, so it stays a supporting test rather than a fourth criterion.
- `wiki/plan/plan.md` does not list the three yet. That is a targeted `/plan AC-42 AC-43 AC-44`
  into S-06, which is not done, so they are the next step before `/implement S-06`.

## 2026-09-25, plan AC-42 AC-43 AC-44 (into S-06), Opus
- Targeted run for the three criteria #38 added. The skill's targeted mode writes a new slice
  file; these went into S-06 instead, as Marcin agreed when the criteria were proposed, because
  they refine S-06's own reconciliation rules, S-06 is still `planned`, and a separate slice
  after S-07 would have had to reopen S-06's code.
- Three rows in `wiki/plan/plan.md`, all e2e: AC-42 the keep window (17:59:45 against an
  18:00:00 snapshot), AC-43 a release after `asOf` standing (1 925 000, 500 000 released at
  18:05, 1 400 000 after a snapshot of 18:00 listing 1 900 000), AC-44 a reopen (omitted at
  12:00, listed at 300 000 at 18:00). Each uses the settable clock the slice already plans.
- The three untagged supporting tests that proved those rules are removed from the slice file,
  since tagged tests now close them. The one that stays is a full client release after `asOf`
  leaving a listed reservation closed: AC-43's rule on a whole invoice, not a criterion.
- Cross-checked: every AC and INV of the spec appears exactly once in the checklist, and all
  twelve S-06 test names match the slice file.
- Branch `docs/plan-S-06`, fast-forwarded to `main` at 1efa91b, since its first PR (#37) is
  merged. Files: `plan.md`, the S-06 slice file, the slice index, `Home.md`, this entry. Nothing
  committed.

## 2026-09-25, implement S-06 (first pass, stopped on a spec conflict), Opus
- Run on Opus 5.5 by Marcin's decision, although the slice is `risk: high` and `CLAUDE.md §8`
  asks for Fable. The skill says to wait for a switch; Marcin had kept Opus twice and then said
  to run implement.
- Built. Domain: `Money.convertBack`; `Reservation.fromSnapshot`, `correctTo`, `drop`, `reopenTo`
  and a stored `heldCorrection` that `held` now includes (ADR-0009 with ADR-0012 1A);
  `Program.adjust`, `isStaleSnapshot`, `reconciledAt`; a pure `reconcile` in
  `domain/reconciliation.ts` that decides every rule of A-12. Application:
  `ApplyReconciliationSnapshot`, the same shape as `ApplyCapacityUpdate`, plus
  `findActiveByProgram`, `findByInvoices` and `findClientMovementsSince` on the ports and fakes.
  Infrastructure: migration `20260925120000_held_correction`, the Prisma reads, the snapshot DTO
  with a 10 000 entry bound and unique invoice ids, the consumer routing by `type`, one warning log
  line per case where a snapshot was not followed, `DevTreasuryProducer.publishSnapshot` and a
  `snapshot` command in `dev:treasury`. Configuration: `RECONCILIATION_KEEP_WINDOW_SECONDS`,
  default 30. Test harness: a `SettableClock` the e2e app can take in place of `CLOCK`.
- All twelve planned tests exist with their exact names and pass: AC-26, AC-27, AC-28, AC-29,
  AC-31, AC-42, AC-43, AC-44 in `api/test/reconciliation.e2e-test.ts`; INV-05, INV-06 in
  `api/test/reconciliation-invariants.e2e-test.ts`; AC-30 and INV-07 as contract tests in
  `treasury-capacity.consumer.integration-test.ts`.
- Not done by the book, said plainly. For `reconcile`'s unit tests, the consumer's unit tests, the
  two contract tests and the e2e files, the test was written first but not run red before the code
  went in. To make up for it each rule was broken on purpose and the tagged tests run against the
  broken code: without the reopen INV-07 fails; without the stale check AC-30 fails; ignoring
  releases after `asOf` fails AC-43 alone; dropping the correction from `held` fails AC-29 alone;
  treating every reservation as older than `asOf` fails INV-06. Every file was restored and
  checked after each break.
- One existing contract test changed meaning, not strength: it used a snapshot as the example of
  a type the contract does not define, which S-06 makes false. It now uses `limit_changed` and
  asserts the same rejection and dead letter.
- Borderline local choices, for review. A snapshot in another currency is refused when it names any
  local reservation, closed ones included, because reopening one would mix currencies; ADR-0007
  speaks only of active ones. A reservation born from a snapshot at exactly `asOf` is still
  compared by a second snapshot of the same moment. A reopen restores at least one minor unit of
  the invoice, so the reservation is really active. A drop writes its adjustment even when `held`
  was already 0, so the ledger shows the closing; a correction that changes nothing writes nothing.
  Local decision 10's warning for an `asOf` ahead of our clock is the note `as_of_ahead_of_our_clock`.
- Stopped on a conflict between INV-02 and ADR-0012, found by the break that treated every
  reservation as older than `asOf`. INV-02 says `0 <= held <= reservedAmount` and the S-03 CHECK
  `reservations_held_within_reserved` enforces it; ADR-0012 1A sets `held` to the listed figure,
  which may be above `reservedAmount` (a reservation of 1 925 000 listed at 2 000 000, or a reopen
  listed above what was reserved). Today such a snapshot violates the CHECK. Put to Marcin: amend
  INV-02 so the upper bound applies to client operations and relax the CHECK, or cap a snapshot's
  figure at `reservedAmount` with a logged note. `wiki/spec/` is not touched here.
- Second finding, older than this slice: a message that fails for a reason other than validation or
  `CURRENCY_MISMATCH` is not dead-lettered. The error propagates, the offset stays uncommitted and
  the message is redelivered forever, which stalls every later message on that partition, other
  programs included. That is right for a database that is away and wrong for a CHECK violation,
  which will fail the same way every time. ADR candidate: telling a permanent failure from a
  transient one in message handling (A-13 clause 4).
- Third finding, about the tests: the keep window also keeps an omitted reservation created after
  `asOf`, so AC-28 and AC-42 would pass even if the "never before its creation" rule were broken.
  INV-06's listed case is the test that holds that rule.
- Tests beyond the plan, for `/ship`: `Money` convertBack; eleven `Reservation` reconciliation
  cases; three `Program` reconciliation cases; twenty-two `reconcile` cases; eight
  `ApplyReconciliationSnapshot` cases; eight snapshot DTO cases; three consumer cases (routing,
  notes logged, unknown type); two configuration cases; four persistence integration cases (active
  reads, listed reads, client movements after a moment, a snapshot reservation and its correction
  round trip); four contract cases (both ADR-0007 cases, an invoice listed twice, the renamed
  unknown type test).
- Deferred: the README's snapshot contract (`/ship`); a hand run of `dev:treasury snapshot`
  against a live stack (`/verify`); everything that depends on the INV-02 decision.

## 2026-09-25, spec (revision: INV-02), Opus
- Marcin decided the conflict the previous entry stopped on, as recommended: INV-02 is amended so
  that `held` stays at or above zero always, and above `reservedAmount` only through a snapshot's
  adjustment, never through a client operation. A Changes row is in the invariants file; the
  glossary's `Held` entry says the same. Done on the slice branch, as A-06 was during S-02, so the
  one PR for S-06 carries the requirement change next to the code it allows.
- The declined option was capping a snapshot's figure at `reservedAmount`: it keeps the old
  wording but throws away what the treasury said, against A-12 and ADR-0012 as accepted.

## 2026-09-25, implement S-06 (INV-02 as amended), Opus
- The storage side of the amendment, test first. The new integration case saving a correction
  above `reservedAmount` failed on `reservations_held_within_reserved`, the reason expected.
  Migration `20260925130000_held_not_negative` replaces that CHECK with `held >= 0`, in a
  migration of its own so no applied one changes its checksum. An untagged e2e case lists
  `INV-B` at 2 000 000 against 1 925 000 reserved and gets `held` 2 000 000 with an adjustment of
  +75 000 through the real consumer, the path that used to stall the partition.
- INV-02's tagged test, a unit property over client releases, is unchanged: that is still what the
  upper bound covers. The finding that a permanent failure stalls a partition stays open as an ADR
  candidate; with this constraint gone no path found so far reaches it with valid input.
- Tests beyond the plan, added to the previous entry's list: the persistence case and the e2e case
  above.

## 2026-09-25, verify S-06, Opus
- VERIFY S-06: PASS, at b88c97d. Run on Opus by Marcin's model choice; the skill table names
  Sonnet for verify.
- Gate: `npm run gate` green in one run, nothing retried. Unit 187 (api) and 2 (web),
  integration 42, e2e 64, cold start smoke 3 with the stack healthy in 287 s.
- Coverage: 9/9 AC (AC-26 to AC-31, AC-42 to AC-44) and 3/3 INV (INV-05 to INV-07) found by tag,
  none skipped or focused, all passing. Levels match the plan: the eight e2e criteria and INV-05
  and INV-06 go through HTTP with a real broker, AC-30 and INV-07 run through the real consumer
  and broker at integration level. INV-06 exercises both directions of its rule, a snapshot
  describing a moment before the reservation (omitted and listed) and after it.
- Style and layers: prose check clean; no nested ternary or braced one-line `if` in the diff; no
  `@nestjs`, ORM or Kafka import in `domain/` (the one "Prisma" hit is a comment).
- Cold start: covered by the gate's smoke, which starts from empty volumes on its own project,
  waits for health, gets `401` without a token and `200` with one, and tears down.
- README followed literally on the default stack, after checking that no stack, volume or port of
  it existed, so `down -v` destroyed nothing but what this check started. Every documented call
  answered as written. The slice's own done item was run by hand: `dev:treasury snapshot`
  produced the unknown, omitted, corrected and older cases on a fresh program, with the logs
  showing the applied and stale outcomes.
- Findings, none blocking: (minor) README does not yet document the snapshot contract, its list
  bound or `dev:treasury snapshot`, which the slice's definition of done requires and `/ship`
  writes; (minor, older than S-06) `dev:treasury` prints a kafkajs `TimeoutNegativeWarning` on
  stderr on every run. Still open from implement, not a verify finding: the ADR candidate for a
  permanently failing message that is redelivered forever.

## 2026-09-25, review S-06, Fable
- REVIEW S-06: 9 findings (2/3/4), at b88c97d, fresh context. Not a pass.
- Findings, most severe first:
  - (blocker, standards) `reconciliation-snapshot-message.dto.ts:78,112`: an entry that is itself
    an array (`activeReservations: [[]]`) passes `@ValidateNested`, then `BigInt(undefined)`
    throws inside the parser, the handler rejects, the offset is never committed and the message
    is redelivered forever, stalling the partition (CLAUDE.md §2, A-13 clause 4, AC-25). Found by
    running the parser on hostile lists.
  - (blocker, spec) `reconciliation.ts:125-131` with `reservation.ts:281-301`: a closed USD
    reservation survives a re-denomination to EUR (not active, not listed), and a later EUR
    snapshot listing it reopens it with `held` in EUR, `reservedAmount` and invoice in USD and
    the USD rate 1 applied as a USD to EUR rate. Violates INV-08 and ADR-0007. Reproduced in the
    domain.
  - (major, spec) `reconciliation.ts:128-129`: two rejection rules beyond A-12 and ADR-0007 (another
    currency refused when the limit part is stale, and when a closed reservation is listed) live
    only in the slice's local decision 3 and the work-log; not in A-12, not in "Owed to /spec".
  - (major, standards) `reconciliation-snapshot-message.dto.ts:39,74`: 1 025 entries at
    `Number.MAX_SAFE_INTEGER` pass validation and overflow `programs.reserved` (BIGINT), a
    database error that is redelivered forever.
  - (major, spec) `apply-reconciliation-snapshot.use-case.ts:101-105` against
    `prisma-unit-of-work.ts:13`: nothing shows a snapshot at the 10 000 entry bound fits the 15 s
    transaction timeout (about 20 000 sequential statements); if it does not, a valid message fails
    the same way on every redelivery. Local decision 5's "one bounded transaction" is unproven.
  - (minor, spec) `reservation.invariants.test.ts:51`: the `[INV-02]` test is still named and built
    for `0 <= held <= reservedAmount` and never releases a corrected reservation, the one path the
    amendment adds.
  - (minor, spec) `reconciliation.ts:85`, local decision 1: two snapshots with the same `asOf` and
    different content end in whichever arrived last, so INV-07 is order dependent on a tie; not
    written in INV-07 or A-13.
  - (minor, standards) `reservation.ts:261`: `drop` (and the `ReconciliationNote` kinds) have no
    glossary word; the glossary says "released by adjustment".
  - (minor, standards) `reconciliation.ts:177`: the closed guard in `stepForOmitted` handles a case
    the input contract excludes (only active reservations are unlisted locals).

## 2026-09-25, implement S-06 (review fixes, round 1, part one), Opus
- The findings that needed no decision, each test first and seen red where a test could fail.
- Blocker, a list entry that is not an object: `activeReservations: [[]]` (and `null`, a string, a
  number) passed validation and `BigInt(undefined)` threw in the mapping. The red test showed that
  exact error; `@IsObject({each: true})` makes it a rejection, dead-lettered like any malformed
  message.
- Major, the listed total overflowing: the entries' sum is now refused above the largest exact
  JSON integer, the bound ADR-0006 already puts on every single amount, since the sum becomes the
  program's `reserved` and availability returns it as one JSON number.
- Major, the list bound not proven: measured first against PostgreSQL. A snapshot of 10 000
  unknown invoices took 12.2 to 12.9 s and one correcting 10 000 known reservations 12.5 s, inside
  the 15 s transaction timeout on this machine but not safely. The writes are now batched:
  `addAll` and `appendAll` are one `createMany` each, keeping the ledger's order, and `saveAll`
  is one `UPDATE ... FROM unnest`. The same two cases now take 4.7 s and 2.5 s, and stay as
  integration tests in `reconciliation-at-the-bound.integration-test.ts`, so a regression fails the
  transaction rather than a stopwatch.
- Minor, dead code: the closed check for an omitted reservation is gone; `local` passes only active
  reservations unlisted, and a comment says so.
- Minor, INV-02 after the amendment: a second property test mixes random snapshot corrections, up
  to twice `reservedAmount`, among random releases, and asserts `held` never below zero and no
  release ever raising it, and that both a correction and one above `reservedAmount` occurred. The
  tagged INV-02 test and its name in `plan.md` are unchanged; its name still states the old bound,
  which is a `/plan` correction to make, not one `/implement` may.
- Minor, the glossary: `Reservation.drop` is renamed `releaseByAdjustment`, the glossary's own
  phrase. The note kinds still need an entry, which is `/spec` work.
- Open, waiting on Marcin: the ADR for a message that will always fail, and the currency and tie
  wording for A-12 and INV-07.

## 2026-09-25, implement S-06 (review fixes, round 1, part two), Opus
- ADR-0013 accepted as Marcin decided, not as recommended: three attempts inside one delivery, then
  the message is set aside as a rejection (dead letter with the error, record `rejected` with the
  error text) and consumption continues. The counting stays in the handler so a restart cannot loop
  it and an outage cannot trip it: giving up needs the broker and the database, so while either is
  away the error propagates and Kafka redelivers. Three consumer tests, seen red first: a failure
  that recovers on the third attempt, a message set aside after three while the next one applies,
  and a message left for redelivery when the dead letter cannot be published.
- Marcin then asked for a table for these errors, and to keep it short since it is an edge case.
  `treasury_message_failures`: one row per failed attempt, best effort, its own transaction, no
  API, no foreign key. One unit expectation (three rows after three failures, seen red) and one
  integration case.
- The review's blocker and major about messages redelivered forever are closed by this for any
  cause, not only the two found; their specific causes were already fixed in part one.
- Still owed: the currency questions (blocker 2 and the major about unwritten rules), the tie on
  `asOf`, and the `/spec` wording for A-13 clause 4, the note kinds and the new table.

## 2026-09-25, implement and spec S-06 (review fixes, round 1, part three), Opus
- Marcin decided the three remaining questions as recommended.
- Blocker 2, test first and seen red on the review's own scenario (the old-currency reservation
  reopened): a listed reservation in another currency than the snapshot is skipped with the note
  `listed_in_other_currency`. The currency guard now refuses another currency only for an active
  reservation or a stale limit part; the unit test that expected a closed old-currency listing to
  refuse the whole snapshot was rewritten for the decision, not weakened.
- Spec wording, on the slice branch as INV-02 was, each with a Changes row: A-12 gains the two
  currency rules (stale limit refused, other-currency listing skipped); A-13 gains clause (6), three
  attempts then unprocessable with each failure kept (ADR-0013), and clause (7), the later of two
  equal `asOf` snapshots wins; INV-07 says such a pair is outside it. Glossary: `Rejected` covers the
  third failed attempt, and new entries for `Failed attempt` and `Reconciliation note`, which lists
  every note kind.
- Review round 1 is now answered finding by finding: both blockers and all three majors fixed, the
  four minors fixed or written down. One stays for `/plan`: the tagged INV-02 test's name still
  states the old bound.

## 2026-09-25, plan S-06 (correction: INV-02 as amended), Opus
- Small correction on the slice branch, as `CLAUDE.md §6` allows. INV-02 was closed by S-05 with a
  property over client releases, and S-06 amended what it says: `held` may now go above
  `reservedAmount`, but only through a snapshot. The S-05 test still holds, but it never releases a
  corrected reservation, which review round 1 noted. So the requirement row moves to S-06 with
  status `in progress` and names the property that mixes snapshot corrections among releases; the
  S-05 test stays as a supporting test without the tag. The S-05 slice file is done and unchanged.
- Cross-checked: every AC and INV in the spec appears once in `plan.md`, and the thirteen S-06
  names match the slice file. Test file and commit columns stay empty for `/ship`.

## 2026-09-25, verify S-06 (second pass, after review fixes round 1), Opus
- VERIFY S-06: PASS, at e3a805e.
- Gate: `npm run gate` green in one run, nothing retried. Unit 194 (api) and 2 (web), integration
  46, e2e 64, cold start smoke 3 with the stack healthy in 46 s.
- Coverage: 9/9 AC and 4/4 INV (INV-02 as amended, INV-05, INV-06, INV-07) found by tag and
  passing, none skipped or focused; levels as the plan names them, INV-02 a unit property.
- Style and layers: prose clean; no nested ternary or braced one-line `if` in the diff since
  review round 1; nothing from Nest, Prisma or Kafka in `domain/`, no ORM in `application/`.
- README followed again on the default stack, after checking none of it existed: every documented
  call answered as written, and a live snapshot through `dev:treasury` corrected a reservation
  with an adjustment. No message was set aside. Stack taken down.
- Findings: none new. Still open and owed to `/ship`: the README's snapshot contract and
  `dev:treasury snapshot`, and the kafkajs warning on stderr (minor, older than S-06).

## 2026-09-25, review S-06 (round 2), Opus
- REVIEW S-06: 7 findings (1/1/5), at 7e2d03d against base d98a421, fresh context. Not a pass.
  Run on Opus 5.5 by Marcin's decision: the skill asks for Fable, which is out of usage credits.
- Round 1, finding by finding: both blockers closed (a list entry that is not an object is now
  rejected, checked with `[[]]`, `[null]`, a string, a number and `true`; a listed reservation in
  another currency is skipped). All three majors closed: the currency rules are in A-12, the
  listed total no longer overflows a `BIGINT`, and the bound is proven for creating and for
  correcting 10 000 reservations. All four minors closed. Two of the fixes leave a narrower gap,
  reported below as minors.
- Findings, most severe first:
  - (blocker, spec) `reconciliation.ts:219-223`: `describedBy` lets a snapshot change a
    reconciliation-created reservation whose `createdAt` equals `asOf`. ADR-0010's decision and
    A-12 both say a reservation created at or after `asOf` is untouched, listed or not. The
    exception is written only in a code comment and in the first implement entry's list of
    borderline choices. `reconciliation.test.ts:271` asserts the behaviour the ADR rules out.
    If the same kind of reservation is omitted, it gets the note `kept_within_window`, although
    it is not in the window before `asOf`.
  - (major, standards) `treasury-capacity.consumer.test.ts:70-86`: `FailingCapacityUpdate`
    subclasses our own use case and overrides `execute`, which is a stub of our own code
    (CLAUDE.md §4). The failure belongs at a port, for example a unit of work or repository
    fake that throws n times.
  - (minor, spec) `reconciliation-snapshot-message.dto.ts:31-35,113-119`: the total bound covers
    only the listed entries. Reservations kept beside them (created after `asOf`, or within the
    window) add to `reserved`, which can pass the exact JSON bound, and then availability answers
    500. Reproduced in the domain: `reserved` came to 18 014 398 509 481 982 and `jsonInteger`
    threw.
  - (minor, spec) `apply-reconciliation-snapshot.use-case.ts:111-112,129,141-149`: reopening
    reads each closed listed reservation's movements with its own query, and the bound tests do
    not cover that path. "Only a few are ever closed" is an unwritten assumption: a snapshot that
    omits everything, followed by one that lists everything, reopens all of them. Measured against
    PostgreSQL: 10 000 reopens took 7.1 s of the 15 s transaction timeout, against 2.5 to 4.7 s
    for the covered cases.
  - (minor, spec) `treasury-capacity.consumer.ts:119,143`: parsing runs outside `attempted`, so
    a throw there (the class of the round 1 blocker, which ADR-0013 names as its motivation) still
    propagates and is redelivered forever. This matches ADR-0013's literal word "applying", but
    it does not close the class. No input found this round reaches it.
  - (minor, spec) `ADR-0013-treasury-messages-that-always-fail.md:103`: Consequences still say
    "the consumer gets one classification function", which belongs to the declined Option 3.
  - (minor, standards) `S-06-reconciliation-snapshots.md:7`: the header says the slice was
    "Implemented on Fable", while its Log and the work-log say Opus.

## 2026-09-25, implement and spec S-06 (review fixes, round 2), Opus
- Blocker, decided by Marcin after a walk through the case: rather than removing the exception
  that let a snapshot correct a reservation it created at the same `asOf`, the rule is made whole
  and written down. A reservation a snapshot created is dated by the treasury's clock, so a later
  snapshot judges it with no keep window, listed or omitted, including one of the same moment,
  which A-13 clause 7 already says supersedes the first. Two tests, seen red (both reservations
  stayed active): released by a same-moment snapshot that omits it, and by one ten seconds later.
  Client reservations keep the window and INV-06 exactly as before. ADR-0010 carries a dated
  amendment, A-12 a sentence and a Changes row, and the glossary's `Keep window` says it is for
  client reservations. The mislabelled `kept_within_window` note goes with it.
- Major, the retry tests stubbed our own use case: replaced by a `FailingUnitOfWork`, a fake of the
  port that throws a set number of times, so the use case under it is the real one.
- Minor, `reserved` past the exact JSON bound through reservations kept beside the list:
  `Program.adjust` refuses it (unit test, seen red), and ADR-0013 sets such a snapshot aside instead
  of availability answering 500.
- Minor, reopening at the bound: the closing movement of every closed reservation comes from one
  `DISTINCT ON` read instead of one query each. The worst case the reviewer measured at 7.1 s now
  takes 2.7 s, and is a third bound test beside creating (5.2 s) and correcting (2.7 s).
- Minor, ADR-0013's Consequences named the declined option's classifier; corrected. Minor, the
  slice header said Fable; corrected.
- Not changed, with the reason: parsing stays outside the three attempts. The reviewer found no
  input that reaches a throw there; round 1's crash was a validation gap, closed by validating every
  entry as an object, and the mapping after validation reads only validated fields. Handling a case
  no input can reach is what `CLAUDE.md §3` rules out.

## 2026-09-25, verify S-06 (third pass, after review fixes round 2), Opus
- VERIFY S-06: PASS, at 36f36ba.
- Gate: `npm run gate` green in one run, nothing retried. Unit 197 (api) and 2 (web),
  integration 48, e2e 64, cold start smoke 3 with the stack healthy in 33 s.
- Coverage: 9/9 AC and 4/4 INV found by tag and passing, none skipped or focused, at the planned
  levels. Style and layers clean in the diff since the second pass.
- README followed again on the default stack after checking none of it existed. Every documented
  call answered as written. Live check of the round 2 rule: two snapshots of the same moment
  through `dev:treasury`, the first creating INV-X, the second omitting it; INV-X ended closed and
  INV-A was corrected. Stack taken down.
- Findings: none new. Owed to `/ship` as before: the README's snapshot contract and
  `dev:treasury snapshot`; the kafkajs warning on stderr (minor, older than S-06).

## 2026-09-25, review S-06 (round 3), Opus
- REVIEW S-06: 6 findings (0/1/5), at 2f1bdbe against base d98a421, fresh context. Not a pass.
  Run on Opus 5.5 by Marcin's decision: the skill asks for Fable, which is out of usage credits.
- Round 2, finding by finding: the blocker is closed (a snapshot-created reservation is judged on
  the treasury's clock with no window, in code, ADR-0010, A-12 and two unit tests). The major is
  closed (`FailingUnitOfWork` fakes the port, the use case is real). The `reserved` JSON bound,
  the reopen read, ADR-0013's Consequences and the slice header are closed. The one not changed,
  parsing outside the three attempts, does not hold: its reason was that no input reaches a throw
  there, and one does (first finding below).
- Findings, most severe first:
  - (major, spec) `treasury-capacity.consumer.ts:119,143`: a message about 10 KB long with an
    unknown field nested 5 000 arrays deep makes `plainToInstance` overflow the stack; the
    `RangeError` leaves `handle`, the offset is not committed and the message is delivered again
    forever, stalling the partition against A-13 clause 4. Same for a capacity update. Reproduced
    on the built consumer: `handle` rejected, no dead letter, no record.
  - (minor, spec) `prisma-ledger.repository.ts:31-40`: the comment says `DISTINCT ON`, but Prisma
    without `nativeDistinct` sends a plain `SELECT ... ORDER BY` and dedupes in memory (query log
    checked), so the read loads every movement of every closed listed reservation, not one each.
  - (minor, spec) `apply-reconciliation-snapshot.use-case.ts:118,121`: the active reservations and
    the client movements after `asOf` are not bounded by `SNAPSHOT_RESERVATIONS_MAX`, so local
    decision 5's "one bounded transaction" does not hold for a program with more active
    reservations than the list bound, and no bound test covers release by omission at scale.
  - (minor, standards) `apply-reconciliation-snapshot.use-case.ts:130,140-143`: `sumOfDeltas`
    filters every movement after `asOf` once per local reservation, quadratic inside the locked
    transaction; 10 000 by 10 000 measured at 0.5 s in plain Node.
  - (minor, spec) `wiki/spec/glossary.md:185-186`: `Snapshot moment` still says reservations
    created at or after `asOf` are never changed by that snapshot, which the round 2 amendment
    made untrue for a snapshot-created reservation of the same moment.
  - (minor, standards) `domain/ports/ledger.repository.ts:13-19`: the doc comment of
    `findClientMovementsSince` now sits above `findLastByReservations`, two stacked blocks, and
    `findClientMovementsSince` has none.

## 2026-09-25, ship S-06, Opus
- Precondition not met, and shipped anyway by Marcin's explicit decision: verify's third pass is
  PASS and newer than the last code commit, but review round 3 has one major. Marcin, after three
  review rounds: "this is enough we are doing a super edge case here, lets move on", and then
  "yes ship". The major (a message nesting an unknown field about 5 000 arrays deep overflows the
  parser, which runs outside ADR-0013's three attempts) and five minors are recorded as known
  limitations in the changelog and carried to S-07. The skill says never to ship over a major;
  this records that the user overrode it, rather than presenting the slice as clean.
- `wiki/plan/plan.md`: the thirteen S-06 rows `done` with their test files, and thirteen `extra`
  rows for the supporting tests. Commit column waits for the merge commit.
- ADR-0010 to ADR-0013 were accepted during the slice; nothing left to finalise.
- Assumptions: nothing the code relies on is missing from the register, with one thing for
  `/spec` to consider: the snapshot's 10 000 entry bound and its listed-total bound are limits on
  what the treasury may send, today local decisions of the slice and not in A-11's contract.
- README gains "Reconcile it": the snapshot contract, a `dev:treasury snapshot` example, the rules
  in one table, the bounds and the three attempts. Run literally on a fresh stack: `INV-A` ended at
  100 000 000 with an adjustment of -20 000 000, `INV-X` was created from the snapshot with its
  `messageId`, and availability reported `asOf`.
- Changelog row, slice status `done`, slice index and Home updated; Home names S-07 next and lists
  what S-06 carries into it.

## 2026-09-25, plan S-07 (revision before implement), Fable
- Targeted run for a slice that already existed: S-07 was written on 2026-09-19 and revised the
  same day for ADR-0001. Reconciled with the shipped S-06 code at 844a7b0 rather than rewritten.
  AC-39's row is unchanged. AC-38's row now names three tagged tests, one e2e and two render
  tests, because the first version's single test could not pass: the served page is an empty
  `#root` until the bundle runs, so panel ids are not in the HTML a cold start check reads.
- Scope made concrete where the first version left a design conversation open: the dev module is
  chosen when the module graph is built (`AppModule.forProfile`), not hidden behind a guard; it
  lives in the capacity area because two of its routes name business words; `POST /dev/treasury`
  has a body and does not pre-judge what the consumer will do; the live ledger needs a new port
  read, `findLatestByProgram`. Five local decisions, no ADR: each follows from ADR-0001, A-17 or
  `CLAUDE.md §2`.
- The S-06 carried findings are scope of S-07's first commits: the parser overflow (the major,
  with a supporting consumer test for both message types), the quadratic `sumOfDeltas`, the two
  ledger comments. The bound test for a program past 10 000 active reservations stays a known
  limitation.
- Spec corrections carried with this plan, since both were owed to `/spec` by the S-06 ship and
  touch no requirement id: the glossary's `Snapshot moment` no longer says a reservation created at
  `asOf` is never changed (review round 3 of S-06), and A-11 carries the two snapshot bounds, with
  a Changes row. Glossary gains `Dev endpoint` and `Demo page`, the words the slice puts into code.
- Every AC and INV appears exactly once in `wiki/plan/plan.md`; the slice file's tagged test names
  match the plan rows word for word.
- Goal set by Marcin for this session: plan, implement, verify, review and ship S-07 with the PRs
  opened and merged without a separate approval each, verify passing and review without a blocker.

## 2026-09-25, implement S-07, Fable
- Carried from S-06 first (commit 38780e6): a throw while parsing a treasury message is now a
  rejection, dead-lettered and recorded, so the 5 000-deep nested field no longer stalls the
  partition (supporting test for both types, red on the real `RangeError` first); the sum of
  client movements after `asOf` is one pass; the ledger port comments are back above their
  methods; the last-row read says what Prisma's `distinct` really sends.
- `api` (0f491ba): `CapacityDevModule` with `DevController`, three `@Public()` routes under the
  `dev` Swagger tag; `AppModule.forProfile` leaves it out in production (local decision 1), so
  `main.ts` reads the profile once before creating the app and the e2e harness passes its own.
  `ListProgramMovements` reads program and rows in one `readSnapshot`; `CapacityReads` gains
  `findLatestByProgram`. Deviation from the slice text, small: `DevTreasuryProducer` is a provider
  of the dev module rather than exported by `CapacityModule`, so production never constructs it.
- AC-39's test passed the first time it ran, as the slice predicted: durability was built by
  S-02 to S-06, and the test proves it rather than drives it.
- `web` (ce12815): four panels, a small client that fetches the dev token once and logs only the
  calls a person caused (the one-second polls are not logged, or the log would be nothing else).
  The generator gained a "One request" button besides start and stop, which is what the render
  test clicks. Found by reading the code before the hand check: the generator's timer restarted on
  every render, and the page re-renders on every poll, so it could never fire; it now reaches the
  latest step through a ref. No test covers that timer; the hand check does not either (see below).
- Tests beyond the plan, for `/ship`: `ListProgramMovements` unit tests (two), in
  `api/src/modules/capacity/application/list-program-movements.query.test.ts`.
- `npm run gate` green: unit 200, web 4, integration 49, e2e 66, cold start 3.
- Hand check on a compose stack of its own (ports 3200/8280): dev token, CORS preflight from the
  web origin, three reservations and a partial release as `demo-web`, a limit change applied, a
  stale update ignored, a snapshot correcting one reservation by -1 000, creating one of 700 and
  keeping two inside the keep window. Headless Chrome rendered the page with all four panels, the
  limit from the api and nine ledger rows. Not checked by hand: clicking the buttons in a browser
  (no browser driver in the repo); the render tests and the curl run cover the same calls.

## 2026-09-25, verify S-07, Sonnet then Opus
- VERIFY S-07: PASS, at 84cf460.
- gate: `npm run gate` green. Unit 200, web 4, integration 49, e2e 66, cold start 3.
- coverage: 2/2 AC, 0 INV. AC-38 has three tagged tests: one e2e over HTTP in
  `api/test/demo.e2e-test.ts` (dev endpoints through the real topic, and `404` in production),
  two render tests in `web/src/app.test.tsx`. AC-39 has one e2e test over HTTP in
  `api/test/restart.e2e-test.ts`. All names match the plan rows word for word. No skipped or
  focused tests.
- Style and layers: prose check clean; no nested ternary and no braced one-line `if` in the
  diff; no `@nestjs` in `domain/`, no ORM or Kafka import in `domain/` or `application/`.
- Cold start on the default stack, after checking none of it existed: ready, `401` without a
  token, `200` with one, `web` `200`, `/dev/token` answers. The README followed literally
  answered as written every time (reserve, EUR reserve, R-1, R-2, R-1 again `409`, the reservation
  read, the snapshot: INV-A at 100 000 000 with -20 000 000, INV-X from reconciliation). Stack
  taken down.
- Findings:
  - (minor) `README.md` table row for `web` still says "the demo lands in S-07"; the
    "See it working" section is `/ship`'s definition of done.

## 2026-09-25, review S-07 (round 1), Opus
- REVIEW S-07: 8 findings (0/1/7), at 6624ac6 against base 5033a33, fresh context. Not a pass.
  Run on Opus, Fable out of credits (Marcin's decision: the skill asks for Fable).
- Carried from S-06, finding by finding: the `sumOfDeltas` pass, the port comments and the
  `findLastByReservations` comment are closed. The major is closed only against the in-memory
  store (first finding below).
- Findings, most severe first:
  - (major, spec) `treasury-capacity.consumer.ts:119,143` with `reject-treasury-message.use-case.ts:35-37`:
    a parse that throws now becomes a rejection, but the rejection writes the parsed payload to
    `treasury_messages.payload` through Prisma, and Prisma 7 overflows the stack serialising JSON
    nested deeper than about 2 000 to 3 000 levels (reproduced with the generated client on
    Postgres 17: depth 2 000 stored, 3 000 and 5 000 `RangeError`; Postgres itself accepts 5 000).
    For the test's own 5 000-deep message the dead letter goes out, `recordOutcome` throws,
    `handle` rejects, the offset is not committed and the message is delivered again forever, one
    more dead letter each time since no record exists for `countIfKnown` to find (A-13 clause 4).
    The supporting test at `treasury-capacity.consumer.test.ts:245` uses the in-memory store,
    which never serialises, so it cannot fail on this.
  - (minor, spec) `web/src/generator.tsx:34,58`: the reserved invoices are not scoped to the
    program; after the program field changes, releases of the old program's invoices go to the new
    program's path, answer `404`, return early and are never dropped, so a share of every later
    tick is a permanent `404`.
  - (minor, standards) `web/src/app.tsx:41-48`: a poll for the previous program id that resolves
    after one for the new id overwrites the ledger with the other program's rows; no stale guard.
  - (minor, standards) `web/src/api.ts:68`: a response that is not JSON (or a failed `JSON.parse`)
    is logged as status `0` with `API_UNREACHABLE`, a code `api` never sent, in a log that says it
    shows what `api` answered; and `bearer` (line 48) caches an empty token forever when
    `/dev/token` answers without one.
  - (minor, standards) `web/src/app.tsx:22,46`: `as Movement[]` and `as Availability` cast
    untrusted `unknown` bodies without narrowing (`CLAUDE.md §3`).
  - (minor, spec) `web/src/treasury-panel.tsx:5`: the comment promises the consumer records the
    message as stale; for a program with no earlier capacity update (any new id typed in the
    program field) it is applied and announces the program.
  - (minor, spec) `web/src/generator.tsx:79`: the once-a-second timer, which already failed once
    (restarted on every render), has no test; the render test clicks "One request" only.
  - (minor, spec) `wiki/slices/S-07-demo-and-operations.md:34`: Scope still says
    `DevTreasuryProducer` becomes a provider exported by `CapacityModule`; the code provides it in
    `CapacityDevModule` (`capacity-dev.module.ts:14`). The plan correction is only in the work-log.

## 2026-09-25, implement S-07 (review round 1 fixes), Opus
- The major: a message that made the parser throw was rejected, but its record kept the payload
  and Prisma overflows serialising the same nesting into jsonb, so the partition still stalled on
  the real store. The record now keeps no payload for such a message (the dead letter still holds
  the original bytes). New integration test on the real database and broker, red first (the next
  valid message never applied), then green:
  `should dead-letter and record a message whose parsing throws, and apply the next one on the real store`.
- The seven minors are carried to `/ship` as known limitations, per the goal Marcin set (a
  review without blockers ships): generator invoices not tied to a program, no stale-answer
  guard on the poll, a non-JSON body logged as `API_UNREACHABLE` and an empty token cached, two
  unnarrowed casts in `app.tsx`, the "Stale" comment, no test of the generator timer, and the
  slice Scope line on where `DevTreasuryProducer` is provided.

## 2026-09-25, verify S-07 (round 2), Opus
- VERIFY S-07: PASS, at 7a3181b. `npm run gate` green: unit 200, web 4, integration 50, e2e 66,
  cold start 3. Coverage unchanged, 2/2 AC. The diff since round 1 is one consumer function and
  one integration test; prose check clean, no layer import moved. Findings: none new.

## 2026-09-25, review S-07 (round 2), Opus
- REVIEW S-07: 9 findings (0/1/8), at 7489555 against base 5033a33, fresh context. Not a pass.
  Run on Opus, Fable out of credits (Marcin's decision: the skill asks for Fable).
- The round 1 major is closed as reported: a 5 000-deep message is dead-lettered once, recorded
  `rejected` with a `null` payload (Prisma stores JS `null` as JSON null in the `NOT NULL` jsonb
  column), and the next message applies. Redelivery reads nothing but `message_id`
  (`wasProcessed`, `recordDuplicate`), so a null payload changes no duplicate count. Probed
  through the real consumer on the real store at depths 1 000 to 3 100: no stall.
- Findings, most severe first:
  - (major, spec) `treasury-capacity.consumer.ts:228-253` with `reject-treasury-message.use-case.ts:35-38`:
    the round 1 major's class is still open for any message the store cannot write. A string
    holding `\u0000` (valid JSON) anywhere in the payload, e.g. an unknown field
    `"note":"a\u0000b"` or `"creditLimit":"\u0000"`, is refused by the DTO without the
    `unparseable` mark, so the payload is kept; Postgres refuses `\u0000` in jsonb (and in
    varchar, so a NUL in `programId` or `messageId` fails the same way), `recordOutcome` throws
    after the dead letter went out, the offset stays uncommitted and the message is delivered
    again forever. Reproduced through the real consumer, broker and database: the next message
    on the partition never applied, 53 dead letters of the same message in 10 s (A-13 clause 4,
    "one bad message must not stall"). Predates S-07, but it is the stall the carried major
    set out to close, and `POST /dev/treasury` (`dev.dto.ts:73-81`) publishes such a
    `programId` or `currency` unchecked.
  - (minor, spec) `treasury-capacity.consumer.ts:312-317`: `storablePayload` rests on "what broke
    the parser breaks Prisma's JSON serialiser too", a coincidence of two stack depths, not a
    rule. Called from the same stack with both functions warm, `parseCapacityUpdate` refuses
    without throwing at depths 2 840 to 2 856 while `recordOutcome` overflows on the same payload
    (reproduced twice). Through the consumer the parse runs on the deeper Kafka handler stack and
    no gap was found, so it holds today by call-stack geometry.
  - Carried from round 1, unchanged since (no `web` file changed after 6624ac6):
  - (minor, spec) `web/src/generator.tsx:34,58`: reserved invoices not scoped to the program;
    after a program change their releases answer `404` forever.
  - (minor, standards) `web/src/app.tsx:41-48`: no stale-answer guard on the poll.
  - (minor, standards) `web/src/api.ts:68`: a non-JSON body logged as `0`/`API_UNREACHABLE`;
    `bearer` (line 48) caches an empty token.
  - (minor, standards) `web/src/app.tsx:22,46`: unnarrowed `as Movement[]`, `as Availability`.
  - (minor, spec) `web/src/treasury-panel.tsx:5`: the "Stale" comment is wrong for a new program.
  - (minor, spec) `web/src/generator.tsx:79`: the once-a-second timer has no test.
  - (minor, spec) `wiki/slices/S-07-demo-and-operations.md:31`: Scope still places
    `DevTreasuryProducer` in `CapacityModule`; the code provides it in `CapacityDevModule`.
- Scratch probes were written under `api/src/` and deleted; the working tree holds only this
  entry and the slice log row.

## 2026-09-25, ship S-07, Sonnet then Opus
- Precondition not met, and shipped anyway by Marcin's standing decision for this session: verify
  round 2 is PASS at 7a3181b and newer than the last code commit, but review round 2 has one
  major. Marcin's goal for the session: "verify must pass and review must have no blockers,
  major can go in", with PRs opened and merged without asking. The major (a `\u0000` in a message
  string makes the rejection record unwritable, so the message stalls its partition) is older
  than S-07 and recorded as a known limitation, not presented as fixed.
- `wiki/plan/plan.md`: AC-38 and AC-39 `done` with their test files; four `extra` rows. The
  commit column stays empty, as for S-04 to S-06, until the merge commit is backfilled.
- No ADR touched. No assumption missing from the register.
- README: the `web` row no longer promises the demo for S-07; new "See it working" section with
  the four panels and the three dev endpoints.
- Slice file: status `done`; its Scope line on where `DevTreasuryProducer` is provided corrected
  to match the code (review minor, a factual correction of the plan text).
- Changelog row, slice index and Home updated: every slice done, the plan complete.

## 2026-09-25, plan S-08 (hardening), Opus
- Marcin asked to fix the open major of S-07 and every carried minor. No requirement changes, so
  no `/spec` step and no row in the requirement table: S-08 plans twelve items as one slice with
  ten supporting tests, untagged, because AC-25 and AC-38 are already closed.
- The major is planned as a property of what gets stored rather than of how parsing ended: a
  payload nested deeper than 32 or carrying NUL is recorded as null, an id with NUL is unreadable,
  the error text loses NUL, and the DTOs refuse NUL in identifiers. That also removes the
  depth coupling review round 2 found. No catch-all around the insert: a database that is away
  must still redeliver (ADR-0013).
- The S-06 minor becomes a bound test of 20 000 active reservations released by omission; if it
  does not fit one transaction, making it fit is implement's job.
- Commit column backfill for S-04 to S-07 goes to `/ship`. No ADR.

## 2026-09-26, implement S-08, Opus
- Items 1 to 4 (1dfd020): `storablePayload` is now a property of the payload, in
  `readable-payload.ts`: null past depth 32 or with NUL in any string or key, iterative walk. The
  `unparseable` mark is gone, so the parser and Prisma no longer need to overflow together.
  `readableString` refuses NUL; error texts lose NUL before the record and the failure row;
  `WithoutNul` (a `ValidateBy`, since a regex with `\u0000` trips `no-control-regex`) on
  `messageId`, `programId`, `invoiceId` of both message DTOs. The integration test on the real
  store was red first (the next valid message never applied), then green.
- Item 5 (27a0ee4): 20 000 active client reservations released by omission in one transaction,
  4.8 s against the 15 s timeout. Passed the first time: the requirement already held, the test
  proves it. Setup writes the reservations in one transaction through the repositories, not
  20 000 reservation requests.
- Items 6 to 11 (web): invoices kept with their program id, a 404 drops one; the poll drops
  answers after its cleanup; `fetch` failure is the only `API_UNREACHABLE`, a non-JSON body keeps
  its status with no code; an empty token is asked for again; `availabilityOf` and `movementsOf`
  narrow with guards, no cast left in `web/src` outside tests; the Stale comment corrected. The
  generator timer test passed first (the S-07 fix was already there); checked it can fail by
  putting the S-07 bug back: it failed, then the file was restored.
- Tests beyond the plan, for `/ship`: `storableText` removes NUL
  (`readable-payload.test.ts`).
- `npm run gate` green: unit 205, web 9, integration 52, e2e 66, cold start 3.

## 2026-09-26, verify S-08, Opus
- VERIFY S-08: PASS, at 9f82e69.
- gate: `npm run gate` green: unit 205, web 9, integration 52, e2e 66, cold start 3.
- coverage: no AC or INV claimed (the slice strengthens AC-25 and AC-38); all ten planned test
  names present and passing, none skipped or focused.
- Style and layers: prose check clean; no nested ternary and no braced one-line `if` in the
  diff; no `@nestjs` in `domain/`, no ORM or Kafka import in `domain/` or `application/`.
- Before verifying: the web fix had landed inside the implement docs commit because a background
  commit did not run; the unpushed branch was split into `e1de323` (web) and `9f82e69` (docs).
- Cold start on the default stack, after checking none of it existed: ready, `401` without a
  token, `200` with one, `web` `200`. Live check of the major: a capacity update with NUL in
  `programId` published through `/dev/treasury`, then a limit change; the limit change applied.
  README reserve and snapshot steps answered as written. Stack taken down.
- Findings: none.
