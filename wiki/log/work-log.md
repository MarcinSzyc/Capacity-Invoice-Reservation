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
