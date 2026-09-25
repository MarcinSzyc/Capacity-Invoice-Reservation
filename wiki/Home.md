# Home

Wiki for the **Program Capacity & Invoice Reservation** brief. Plain Markdown,
Obsidian vault root is this folder. Working rules: `../CLAUDE.md`.

## Start here

- [[spec/brief]]: the brief, transcribed
- [[spec/acceptance-criteria]] · [[spec/invariants]] · [[spec/assumptions]] · [[spec/glossary]] · [[spec/open-questions]]
- [[plan/plan]]: every AC and INV with status · [[slices/README]]: slices, one file each
- [[decisions/README]]: architecture decision records
- [[log/work-log]] · [[log/changelog]]
- [[testing/strategy]]

## Status

| Gate | State |
|---|---|
| spec | done 2026-09-19: 28 questions answered, A-01..A-19, AC-01..AC-41, INV-01..INV-11 |
| plan | done 2026-09-19: 7 slices S-01..S-07, 53 requirement rows, 11 ADRs; ADR-0001 to ADR-0008 accepted; S-03 revised 2026-09-22 against the shipped S-02 code; S-04 revised 2026-09-22 against the shipped S-03 code; A-10 amended twice for S-04; S-05 revised 2026-09-23 against the shipped S-04 code and ADR-0009; AC-15, AC-27, A-08 and A-09 amended during S-05; S-06 revised 2026-09-25 against the shipped S-05 code, ADR-0012 proposed |

| Slice | State |
|---|---|
| S-01 Walking skeleton | done 2026-09-19: AC-00, AC-41 |
| S-02 Programs from the treasury | done 2026-09-21: AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40, INV-10 |
| S-03 Reservations and the capacity invariant | done 2026-09-22: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11 |
| S-04 Cross-currency reservations | done 2026-09-23: AC-06, AC-07, INV-08 |
| S-05 Releases | done 2026-09-25: AC-10 to AC-19, AC-34, INV-02 |
| S-06 Reconciliation snapshots | planned, next |
| S-07 Demo page and operations | planned |

Next: decide [[decisions/ADR-0010-reconciliation-created-at-versus-as-of]],
[[decisions/ADR-0011-reconciliation-created-reservations]] and
[[decisions/ADR-0012-snapshot-corrections-on-a-derived-held]] in the review of `docs/plan-S-06`,
then a `/spec` PR for the A-12 and glossary wording those decisions owe, then `/implement S-06` on
branch `slice/S-06-reconciliation-snapshots`. S-06 is `risk: high` (a snapshot disagreeing with a
`held` that ADR-0009 derives from the invoice, two clocks, shuffled delivery) and wants Fable per
`CLAUDE.md §8`. ADR-0012 is new: a correction must survive the next release, a listed reservation
is compared as of `asOf` so a release after it is not undone, and INV-07 needs a rule for an
invoice that is dropped and then listed again.
