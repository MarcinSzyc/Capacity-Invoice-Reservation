---
name: ship
description: Close a slice after /verify and /review pass. Updates changelog, traceability, Home status, README and finalises ADRs, then proposes the commit message. Use once per slice. Does not change product code.
model: sonnet
---

You are running the **ship** gate for slice `$ARGUMENTS`. Read `CLAUDE.md §6, §7, §9`,
the slice in `wiki/plan/plan.md`, and the last `VERIFY` and `REVIEW` entries for this
slice in `wiki/log/work-log.md`.

## Preconditions

- The most recent `VERIFY S-xx` is `PASS` and the most recent `REVIEW S-xx` has zero
  blockers and zero majors, and both are newer than the last code change. If not, stop
  and say which gate is missing.

## Steps

1. **Traceability.** In `wiki/plan/traceability.md` fill test file for every AC/INV of
   the slice. Add rows for tests `/implement` reported beyond the plan, marked `extra`.
   Commit column is filled after the commit exists.
2. **ADRs.** Every ADR the slice touched moves from `proposed` to `accepted` with the
   decision and consequences written, or to `rejected` with why. An ADR still undecided
   blocks shipping: ask the user.
3. **Assumptions.** If the work-log recorded an assumption the code relies on that is not
   in `wiki/spec/assumptions.md`, do not add it yourself. List it and ask the user to run
   `/spec`.
4. **Changelog.** Append to `wiki/log/changelog.md`: slice id, date, what a client of the
   service can now do, AC/INV closed, ADRs accepted, known limitations.
5. **README.** Make sure the root `README.md` still runs the service from a clean
   checkout as the code now stands, and links to `wiki/spec/assumptions.md`,
   `wiki/decisions/`, and `wiki/Home.md`. Keep it short; it is the reviewer's entry point.
6. **Home.** Mark the slice done in `wiki/Home.md`, name the next slice.
7. **Pull request.** Propose, do not execute: the PR title `feat(S-xx): <outcome>` and
   a description with outcome, AC/INV closed, ADRs accepted, how it was tested, known
   limitations. The slice branch is `slice/S-xx-<slug>`, rebased on `main`, merged with
   `--no-ff`, merge commit tagged `S-xx` (see `CLAUDE.md §6`). Open, merge and tag only if
   the user says so; afterwards fill the commit column in traceability with the merge
   commit.
8. Append a work-log entry.

## You must not

- Modify `src/` or `test/`.
- Accept an ADR or add an assumption on the user's behalf.
- Ship over a failed or stale verify/review.
