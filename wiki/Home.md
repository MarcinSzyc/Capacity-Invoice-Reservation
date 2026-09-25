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
| spec | done 2026-09-19: 28 questions answered, A-01..A-19, AC-01..AC-41, INV-01..INV-11; revised 2026-09-25: A-12 amended, AC-42..AC-44 added for S-06 |
| plan | done 2026-09-19: 7 slices S-01..S-07, 53 requirement rows, 11 ADRs; ADR-0001 to ADR-0008 accepted; S-03 revised 2026-09-22 against the shipped S-02 code; S-04 revised 2026-09-22 against the shipped S-03 code; A-10 amended twice for S-04; S-05 revised 2026-09-23 against the shipped S-04 code and ADR-0009; AC-15, AC-27, A-08 and A-09 amended during S-05; S-06 revised 2026-09-25 against the shipped S-05 code; ADR-0010, ADR-0011 and ADR-0012 accepted 2026-09-25; AC-42 to AC-44 planned into S-06 |

| Slice | State |
|---|---|
| S-01 Walking skeleton | done 2026-09-19: AC-00, AC-41 |
| S-02 Programs from the treasury | done 2026-09-21: AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40, INV-10 |
| S-03 Reservations and the capacity invariant | done 2026-09-22: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11 |
| S-04 Cross-currency reservations | done 2026-09-23: AC-06, AC-07, INV-08 |
| S-05 Releases | done 2026-09-25: AC-10 to AC-19, AC-34, INV-02 |
| S-06 Reconciliation snapshots | done 2026-09-25: AC-26 to AC-31, AC-42 to AC-44, INV-02 (amended), INV-05 to INV-07 |
| S-07 Demo page and operations | planned, next |

Next: `/plan` revision of S-07 against the shipped S-06 code, then `/implement S-07` on branch
`slice/S-07-demo-and-operations`. S-07 is `risk: low` (AC-38, AC-39) and runs on Opus per
`CLAUDE.md §8`. Carried from S-06, for its first commit or its plan: the deeply nested message that
overflows the parser outside the three attempts (the one open major, shipped as an edge case), the
five minors of review round 3, and A-11 wording for the snapshot's list bound and listed-total
bound (`/spec`).
