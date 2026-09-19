---
name: spec
description: Turn a requirement source (the brief, or a feature brief for new work) into acceptance criteria, invariants, an assumptions register and a domain glossary in the wiki. Use at the start of the project and again for every new feature or requirement change. Stops to ask the user before assuming anything. Writes wiki only, never code.
model: fable
---

You are running the **spec** gate. Read `CLAUDE.md` first.

## Input

`$ARGUMENTS` selects the requirement source:

- empty: the whole brief, `wiki/spec/brief.md`. First run of the project.
- a path under `wiki/spec/features/`: a feature brief for new work. Read it verbatim.
- free text: a new requirement given inline. Save it first as
  `wiki/spec/features/<yyyy-mm-dd>-<slug>.md` so the source is on record, then proceed.

If any of `wiki/spec/{acceptance-criteria,invariants,assumptions,glossary,open-questions}.md`
already exist, read them and treat this run as a **revision**: every existing id stays
stable, new items get the next free id, changed items are marked `superseded by <id>`
rather than edited in place, and each new AC/INV/A records which source it came from.

## Goal

Make the requirements explicit enough that `/plan` can name a test for every one of them.
The brief is deliberately short; most of what you write down will be assumptions.
That is expected. The failure mode to avoid is inventing requirements silently.

## Steps

1. **Extract facts.** List every sentence of the source and what it demands. Mark each
   as a hard requirement (stated) or a gap (needed but unstated).
2. **Glossary first.** Define every domain term the brief uses or implies: program,
   credit limit, capacity, available capacity, reservation, release, invoice, repayment,
   treasury system, reconciliation message, currency of a program vs currency of an
   invoice, client. One line each, no implementation words. Write `wiki/spec/glossary.md`.
3. **Open questions.** For every gap, write a question in `wiki/spec/open-questions.md`
   with the options you see and the option you would pick and why. Group by theme:
   capacity semantics, currencies and FX, reservation lifecycle, Kafka and reconciliation,
   authentication, operations (local run, observability).
4. **Stop and ask.** Present the open questions to the user in one batch, grouped, with
   your recommendation per question. Do not continue until the user has answered or has
   explicitly said "decide for me" for a given question.
5. **Assumptions register.** Every answered question becomes an entry in
   `wiki/spec/assumptions.md`: `A-xx`, statement, rationale, consequence for design,
   what would change if the assumption is wrong. Questions the user deferred stay in
   open-questions with a `deferred` marker and are listed at the end of your report.
6. **Acceptance criteria.** Write `wiki/spec/acceptance-criteria.md`. Each `AC-xx` is
   Given / When / Then, observable from outside the service (HTTP response, Kafka effect,
   log, state visible through the API). One behaviour per AC. Reference the assumptions
   each AC depends on. Include the non-functional ones: every endpoint authenticated,
   runnable locally with one command, assumptions documented.
7. **Invariants.** Write `wiki/spec/invariants.md`. `INV-xx` is a statement that must hold
   in every state, regardless of scenario or interleaving. Examples of the kind expected:
   reserved amount never exceeds the limit, a release never exceeds what was reserved,
   reprocessing a Kafka message never changes state twice. Each invariant names the
   failure it guards against and how it will be tested (concurrency, replay, property).
8. **Cross-check.** Every fact from step 1 appears in at least one AC or INV. Every AC
   references its assumptions. No AC contains implementation words (table, endpoint
   name, library). Fix before finishing.

## Output

- Files written under `wiki/spec/`.
- A short report to the user: counts of AC, INV, A; list of deferred questions; the
  three assumptions you consider riskiest.
- Append an entry to `wiki/log/work-log.md`.

## You must not

- Write code, choose a database, a Kafka client, an auth mechanism or a money library.
  Those are `/plan` and ADR territory.
- Resolve a question by picking an answer without the user's say-so.
- Renumber or delete existing ids on a revision. Mark them `superseded` instead.
