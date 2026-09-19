---
name: plan
description: Turn the acceptance criteria and invariants into a risk-ordered list of vertical slices (one file each under wiki/slices) with named tests and ADR candidates, and fill the requirement checklist in wiki/plan/plan.md. Use after every /spec run, for the initial plan and for new features added later. Plans only, writes no code.
model: fable
---

You are running the **plan** gate. Read `CLAUDE.md`, then everything in `wiki/spec/`,
then `wiki/plan/plan.md`, `wiki/slices/README.md` and `wiki/slices/*.md` if they exist, then the current `src/` tree if any. Do not start before the spec gate is closed: if open-questions has
non-deferred entries, stop and send the user back to `/spec`.

## Revision mode

When `wiki/slices/README.md` exists, this is a revision. Slice files marked done are never
changed. Only AC/INV not yet in `wiki/plan/plan.md` get new slices, numbered after the last
existing one. A new requirement that invalidates a shipped slice gets a new slice that
changes it, with the old AC marked `superseded` in `wiki/plan/plan.md`, never a rewrite of history.

## Goal

A plan `/implement` can execute one slice at a time without further design conversations,
and a requirement checklist in `wiki/plan/plan.md` that proves every AC and INV has a test
waiting for it.

## Steps

1. **Walking skeleton first.** Slice `S-01` is always the thinnest end-to-end path:
   app boots, one authenticated endpoint answers, docker compose brings up the
   dependencies, `npm run gate` exists and is green with a trivial test. Nothing else
   can be verified before this exists.
2. **Cut vertical slices.** Each subsequent slice delivers a coherent set of AC and INV
   through all layers (domain, application, infrastructure, tests). No horizontal slices
   ("all entities", "all repositories").
3. **Order by risk, not by the brief's narrative.** Rank slices by how much
   uncertainty they remove. Concurrency of reservations, bulk reconciliation semantics
   and multi-currency arithmetic are the usual candidates for early slices. Explain the
   ordering in one paragraph.
4. **One file per slice**, `wiki/slices/S-xx-<slug>.md`, containing:
   - `S-xx` id, title, one-sentence outcome, status (`planned`, `in progress`, `done`)
   - AC and INV ids covered
   - `risk: low | medium | high` with one line of justification. High-risk slices are
     implemented on Fable per `CLAUDE.md §8`.
   - dependencies on earlier slices
   - **tests by name**, one per AC/INV, in the exact `it('[AC-xx] should ...')` form,
     with the test level (unit / integration / e2e / invariant / contract)
   - ADR candidates: decisions this slice forces, with the alternatives you already see
   - definition of done specific to the slice, if anything beyond `CLAUDE.md §9`
   - a `Log` section at the end, appended to by implement, verify, review and ship with
     one line each (date, gate, result)

   Then fill the table in `wiki/slices/README.md`: slices in execution order with risk,
   dependencies, AC/INV ids and status, plus the paragraph explaining the order. The index
   never repeats slice detail; it links to the slice files.
5. **Requirement checklist.** Fill `wiki/plan/plan.md`: one row per AC and INV with
   slice, status `planned`, test name and level. Test file and commit stay empty until
   `/ship` fills them. Every AC and INV appears exactly once. An AC without a
   test or a test without an AC is a planning error; fix it before finishing.
6. **ADR drafts.** For every ADR candidate that must be decided before its slice starts,
   create `wiki/decisions/ADR-xxxx-<slug>.md` from the template with status `proposed`,
   context filled, options listed, decision empty. Do not decide here unless the user
   asks you to; present the options and your recommendation.
7. **Present to the user.** Slice list with risk and order, the ADRs that need a decision
   before `S-01`, and any AC you found untestable as written (send those back to `/spec`).

## Output

- `wiki/plan/plan.md` (requirement checklist), `wiki/slices/README.md` (slice index), one
  `wiki/slices/S-xx-<slug>.md` per slice, proposed ADR files.
- Update `wiki/Home.md` status section.
- Append an entry to `wiki/log/work-log.md`.

## You must not

- Write product code or tests.
- Decide an ADR without the user.
- Produce a slice without named tests.
