---
name: implement
description: Implement one planned slice test-first (red, green, refactor) following CLAUDE.md architecture and style. Use with a slice id, e.g. "/implement S-03". Runs the quick gate before finishing and writes a work-log entry. Never edits spec, plan or ADR decisions.
---

You are running the **implement** gate for slice `$ARGUMENTS`. Read `CLAUDE.md`, the
slice's section in `wiki/plan/plan.md`, the AC/INV it covers in `wiki/spec/`, the
relevant rows of `wiki/plan/traceability.md`, `wiki/testing/strategy.md`, and every ADR
the slice references. Then read the current code you will touch.

## Preconditions, check before writing anything

- The slice exists in the plan and its dependencies are marked done in `wiki/Home.md`.
- Every ADR the slice depends on has status `accepted`. If one is still `proposed`,
  stop and ask the user to decide it. Do not decide it yourself.
- If the slice is `risk: high` and the current model is not Fable, tell the user and
  wait for them to switch with `/model` (see `CLAUDE.md §8`).

## Loop, one test at a time

Take the slice's test names from the plan in order. For each:

1. **Red.** Write the test exactly as named (`it('[AC-xx] should ...')`), at the level the
   plan says. Run it. It must fail for the right reason. A test that passes before the
   code exists is a wrong test.
2. **Green.** Write the smallest code that makes it pass. Domain first, then
   application, then infrastructure. Respect the layer rules in `CLAUDE.md §2`: no
   `@nestjs/*` import in `domain/`, no ORM outside `infrastructure/`.
3. **Refactor.** Remove duplication, name things after the glossary
   (`wiki/spec/glossary.md`), keep the tests green.
4. Run `npm run gate:quick`. Fix anything red before the next test.

Rules during the loop:

- Fakes, not mocks, for our own ports. Mock only true third parties at the boundary.
- If you need a decision that is not in an ADR and has real alternatives, do not pick
  silently: draft `wiki/decisions/ADR-xxxx-<slug>.md` with status `proposed`, ask the
  user, continue only after the answer. Small local choices do not need an ADR; use
  judgement, and note the borderline ones in the work-log.
- If an AC turns out to be ambiguous or wrong while implementing, stop and report it.
  Do not edit `wiki/spec/` here.
- Do not touch the wiki except `wiki/log/work-log.md`.
- Commit only when the user asks. If asked: Conventional Commits, scope is the slice id,
  body lists AC/INV/ADR ids.

## Finish

- `npm run gate:quick` green.
- Every test name from the plan exists and passes; if you added tests beyond the plan,
  list them so `/ship` can add them to traceability.
- Append a work-log entry: what was built, decisions made and why, anything deferred,
  proposed ADRs awaiting decision.
- Report to the user, then hand off to `/verify`.

## You must not

- Skip red. Write code before its test.
- Weaken or delete a failing test to get green.
- Edit spec, plan, traceability or ADR decisions.
