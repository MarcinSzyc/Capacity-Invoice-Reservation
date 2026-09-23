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
| plan | done 2026-09-19: 7 slices S-01..S-07, 53 requirement rows, 11 ADRs; ADR-0001 to ADR-0008 accepted; S-03 revised 2026-09-22 against the shipped S-02 code; S-04 revised 2026-09-22 against the shipped S-03 code; A-10 amended twice for S-04 |

| Slice | State |
|---|---|
| S-01 Walking skeleton | done 2026-09-19: AC-00, AC-41 |
| S-02 Programs from the treasury | done 2026-09-21: AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40, INV-10 |
| S-03 Reservations and the capacity invariant | done 2026-09-22: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11 |
| S-04 Cross-currency reservations | done 2026-09-23: AC-06, AC-07, INV-08 |
| S-05 Releases | planned, next |
| S-06 Reconciliation snapshots | planned |
| S-07 Demo page and operations | planned |

Next: `/plan` review of S-05 against the shipped S-04 code, then `/implement S-05` on branch
`slice/S-05-releases`. S-05 is `risk: high` (proportional conversion of instalments with the
stored rate, exact closing of the last one) and wants Fable per `CLAUDE.md §8`.
[[decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]] is still `proposed`
and has to be decided in the S-05 plan PR before `/implement` may start. Two findings carried
from S-04: no `CHECK (rate > 0)` on `reservations.rate`, and the glossary's `Adapter`, `Seam`
and `Fake` entries still illustrate a `RateProvider` that A-02 decided against.
