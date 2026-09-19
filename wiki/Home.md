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
| plan | done 2026-09-19: 7 slices S-01..S-07, 53 requirement rows, 11 ADRs; ADR-0001 to ADR-0004 accepted |

| Slice | State |
|---|---|
| S-01 Walking skeleton | done 2026-09-19: AC-00, AC-41 |
| S-02 Programs from the treasury | planned, next |
| S-03 Reservations and the capacity invariant | planned |
| S-04 Cross-currency reservations | planned |
| S-05 Releases | planned |
| S-06 Reconciliation snapshots | planned |
| S-07 Demo page and operations | planned |

Next: review and merge the S-01 pull request, including the `CLAUDE.md` §2 and §4 amendments it
carries, then decide [[decisions/ADR-0005-authentication-bearer-jwt]] and confirm the wording of
A-05 before `/implement S-02`.
