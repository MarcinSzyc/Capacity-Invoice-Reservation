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
| plan | done 2026-09-19: 7 slices S-01..S-07, 53 requirement rows, 11 ADRs; ADR-0001 to ADR-0008 accepted; S-03 revised 2026-09-22 against the shipped S-02 code; S-04 revised 2026-09-22 against the shipped S-03 code; A-10 amended twice for S-04; S-05 revised 2026-09-23 against the shipped S-04 code and ADR-0009 |

| Slice | State |
|---|---|
| S-01 Walking skeleton | done 2026-09-19: AC-00, AC-41 |
| S-02 Programs from the treasury | done 2026-09-21: AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40, INV-10 |
| S-03 Reservations and the capacity invariant | done 2026-09-22: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11 |
| S-04 Cross-currency reservations | done 2026-09-23: AC-06, AC-07, INV-08 |
| S-05 Releases | planned, next |
| S-06 Reconciliation snapshots | planned |
| S-07 Demo page and operations | planned |

Next: merge the plan revision on `docs/plan-S-05`, then `/implement S-05` on branch
`slice/S-05-releases`. S-05 is `risk: high` (a release converts with the stored rate, three
instalments must close at exactly zero, and a repeated `releaseId` must answer the original
outcome without touching state) and wants Fable per `CLAUDE.md §8`.
[[decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]] is accepted, Option
2 and Option A, and is the only ADR the slice needs. The two findings carried from S-04 are its
first commit: the `CHECK (rate > 0)` on `reservations.rate`, and the glossary's `Adapter`,
`Seam` and `Fake` entries that still illustrate a `RateProvider` A-02 decided against. The
glossary half is `/spec` work and also owes an entry for `releasedInvoiceAmount`, a new domain
word this slice puts in code.
