---
name: plan
description: Turn the acceptance criteria and invariants into a risk-ordered list of vertical slices, each with named tests and ADR candidates, and build the AC-to-test traceability table. Use after every /spec run, for the initial plan and for new features added later. Plans only, writes no code.
model: fable
---

You are running the **plan** gate. Read `CLAUDE.md`, then everything in `wiki/spec/`,
then `wiki/plan/plan.md` and `wiki/plan/traceability.md` if they exist, then the current
`src/` tree if any. Do not start before the spec gate is closed: if open-questions has
non-deferred entries, stop and send the user back to `/spec`.

## Revision mode

When `wiki/plan/plan.md` exists, this is a revision. Slices marked done are never
changed. Only AC/INV not yet in traceability get new slices, numbered after the last
existing one. A new requirement that invalidates a shipped slice gets a new slice that
changes it, with the old AC marked `superseded` in traceability, never a rewrite of history.

## Goal

A plan `/implement` can execute one slice at a time without further design conversations,
and a traceability table that proves every requirement has a test waiting for it.

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
4. **Per slice, write:**
   - `S-xx` id, title, one-sentence outcome
   - AC and INV ids covered
   - `risk: low | medium | high` with one line of justification. High-risk slices are
     implemented on Fable per `CLAUDE.md §8`.
   - dependencies on earlier slices
   - **tests by name**, one per AC/INV, in the exact `it('[AC-xx] should ...')` form,
     with the test level (unit / integration / e2e / invariant / contract)
   - ADR candidates: decisions this slice forces, with the alternatives you already see
   - definition of done specific to the slice, if anything beyond `CLAUDE.md §9`
5. **Traceability.** Write `wiki/plan/traceability.md` as one table:
   `id | slice | test name | test file (planned) | commit`. Test file and commit stay
   empty until `/ship` fills them. Every AC and INV appears exactly once. An AC without a
   test or a test without an AC is a planning error; fix it before finishing.
6. **ADR drafts.** For every ADR candidate that must be decided before its slice starts,
   create `wiki/decisions/ADR-xxxx-<slug>.md` from the template with status `proposed`,
   context filled, options listed, decision empty. Do not decide here unless the user
   asks you to; present the options and your recommendation.
7. **Present to the user.** Slice list with risk and order, the ADRs that need a decision
   before `S-01`, and any AC you found untestable as written (send those back to `/spec`).

## Output

- `wiki/plan/plan.md`, `wiki/plan/traceability.md`, proposed ADR files.
- Update `wiki/Home.md` status section.
- Append an entry to `wiki/log/work-log.md`.

## You must not

- Write product code or tests.
- Decide an ADR without the user.
- Produce a slice without named tests.
