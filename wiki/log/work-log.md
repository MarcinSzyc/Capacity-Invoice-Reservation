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
