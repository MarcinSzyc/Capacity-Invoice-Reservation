---
name: implement
description: Implement one planned slice test-first (red, green, refactor) following CLAUDE.md architecture and style. Use with a slice id, e.g. "/implement S-03". Runs the quick gate before finishing and writes a work-log entry. Never edits spec, plan or ADR decisions.
---

You are running the **implement** gate for slice `$ARGUMENTS`. Read `CLAUDE.md`, the
slice file `wiki/slices/$ARGUMENTS-*.md`, the AC/INV it covers in `wiki/spec/`, their
rows in `wiki/plan/plan.md`, `wiki/testing/strategy.md`, and every ADR
the slice references. Then read the current code you will touch.

## Preconditions, check before writing anything

- **Branch first.** Put yourself on `slice/$ARGUMENTS-<slug>` before writing anything, so no
  code is ever written onto `main` (`CLAUDE.md §6`). Creating a branch lets nothing out of the
  working tree, so it needs no permission; committing it still does. Check `git status` first
  and stop if the tree is dirty, rather than carrying someone else's work onto a new branch.
  Cut it from an up to date `main`; if it already exists, switch to it and continue there.
- The slice file exists and every slice it depends on has status `done` in its own file.
  Set this slice's status to `in progress` and append a line to its `Log` section.
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
- Do not touch the wiki except `wiki/log/work-log.md` and the `Log` section and status of
  this slice's file.
- Never commit or push on your own. When a step is green and worth a commit, stop, name
  the files and the message you would use, and ask. If the user says yes: Conventional
  Commits, scope is the slice id, body lists AC/INV/ADR ids. A yes to commit is not a
  yes to push.

## Finish

- `npm run gate:quick` green.
- Every test name from the plan exists and passes; if you added tests beyond the plan,
  list them so `/ship` can add them to `wiki/plan/plan.md`.
- Append a work-log entry: what was built, decisions made and why, anything deferred,
  proposed ADRs awaiting decision.
- Report to the user, then hand off to `/verify`.

## You must not

- Skip red. Write code before its test.
- Commit, push or open a PR without an explicit yes for that action.
- Weaken or delete a failing test to get green.
- Edit spec, the requirement checklist, slice content or ADR decisions.
