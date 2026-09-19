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
