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
