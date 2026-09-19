# S-06 Reconciliation snapshots

- Outcome: a treasury snapshot brings a program's limit and reservations up to date as of one moment, every difference is an explicit adjustment in the ledger, and nothing a client was already told is undone by an older snapshot.
- Status: planned
- AC: AC-26, AC-27, AC-28, AC-29, AC-30, AC-31
- INV: INV-05, INV-06, INV-07
- Risk: high. Reconciliation: comparing two systems' clocks, set differences between local and remote reservations, monotonic application under shuffled delivery, replay of everything. Implemented on Fable per `CLAUDE.md §8`.
- Depends on: S-05. ADRs that must be accepted first: [[../decisions/ADR-0009-reconciliation-created-at-versus-as-of]], [[../decisions/ADR-0010-reconciliation-created-reservations]] (and ADR-0006 from S-02 for the currency field).

## Scope

Domain:
- `Snapshot` value: `messageId`, `asOf`, `currency`, `creditLimit`, `activeReservations: {invoiceId, heldAmount}[]` in program currency.
- `Program.applySnapshot(snapshot, localReservations)` returns a list of movements and a new `asOf`, or `stale` when `asOf <= program.asOf`:
  - limit: applied as a `limit_set` movement when `asOf >= limitEventTime`, otherwise the limit part is skipped and noted (INV-07 is per fact);
  - for each local reservation created before `asOf` per ADR-0009: in both sets with equal `held` → nothing; differing → `adjustment` with `deltaHeld = snapshot.held - local.held`; only local → `adjustment` releasing to `0`;
  - only in the snapshot → new `Reservation` with `source: reconciliation` (amounts and rate per ADR-0010) and an `adjustment` movement of `+heldAmount`;
  - local reservations created at or after `asOf` are untouched, listed or not (a listed one created after `asOf` is a clock anomaly: keep local, log a warning).
  - every movement carries `messageId`; `reserved` is recomputed; overcommit is legal here (A-06).
- Domain errors: `SnapshotCurrencyMismatch` per ADR-0006.

Application:
- `ApplyReconciliationSnapshot` use case: one transaction, lock the program row (create the program if unknown, A-05), dedupe by `messageId`, staleness by `asOf`, apply, persist reservations and movements, update balances and `programs.as_of`, record the outcome.

Infrastructure:
- Snapshot DTO and validator for `type: 'reconciliation_snapshot'`: `{messageId, type, programId, currency, creditLimit, asOf, activeReservations: [{invoiceId, heldAmount}]}`; the consumer from S-02 dispatches by `type`.
- `reservations.source` gains the value `reconciliation`; `GET .../reservations/:invoiceId` shows it and shows `adjustment` movements with `messageId`.
- Availability `asOf` now returns the last applied snapshot moment (AC-31).
- Dev tooling: `npm run dev:treasury -- snapshot --program PRG-1 --as-of ... --limit ... --reservations INV-A:70000000,...`.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-26] should add an unknown reservation from the snapshot with source reconciliation and an adjustment movement')` | e2e | snapshot lists `INV-X` 700 000; `GET` shows source `reconciliation`, `held` 700 000, one `adjustment` movement with the snapshot's `messageId`; availability down by 700 000 |
| `it('[AC-27] should release by adjustment a reservation created before asOf that the snapshot omits')` | e2e | `INV-A` created, snapshot with a later `asOf` omits it; `held` 0, closed, `adjustment` movement; availability restored |
| `it('[AC-28] should keep a reservation created after asOf that the snapshot omits')` | e2e | reserve, then a snapshot whose `asOf` is 30 s before the reservation's `createdAt`; reservation unchanged, no movement |
| `it('[AC-29] should correct held to the snapshot value with an adjustment for the difference')` | e2e | `INV-B` at 1 925 000, snapshot says 1 900 000; `held` 1 900 000, `adjustment` of minus 25 000 |
| `it('[AC-30] should ignore a snapshot older than the last applied one and record it as stale')` | contract | 18:00 applied, then 12:00 arrives; ledger unchanged, `treasury_messages` outcome `stale` |
| `it('[AC-31] should set limit and currency from the snapshot and expose its asOf in availability')` | e2e | limit 7 000 000, `asOf` echoed in availability; same currency as the program (the mismatch case is ADR-0006's own untagged contract test) |
| `it('[INV-05] should leave every balance and ledger row unchanged when every message and request of a scenario is replayed')` | invariant (e2e) | scenario: capacity update, two reservations, a partial release, a snapshot, a limit change; snapshot the ledger; replay every Kafka message and every HTTP request with the same ids; ledger and balances byte-identical, HTTP replays answer `409` |
| `it('[INV-06] should never alter a reservation by a snapshot whose asOf precedes its creation')` | invariant (e2e) | interleavings with controlled clocks: snapshot arriving after the reservation but describing a moment before it, and a snapshot describing a moment after it; only the second may touch it |
| `it('[INV-07] should reach the same final state for shuffled and reversed message order as for in-order delivery')` | invariant (contract) | five capacity updates and three snapshots for one program delivered in order, reversed and in three random shuffles into fresh programs; final limit, `asOf`, reservations and `reserved` identical across runs |

## ADR candidates

- [[../decisions/ADR-0009-reconciliation-created-at-versus-as-of]]: strict `createdAt < asOf` vs a tolerance window in favour of keeping; which clock stamps `createdAt`.
- [[../decisions/ADR-0010-reconciliation-created-reservations]]: what `invoiceAmount`, `invoiceCurrency` and `rate` a reservation born from a snapshot carries, and how a client later releases it.

## Definition of done

Beyond `CLAUDE.md §9`:

- The dev treasury script can produce every snapshot case of the ACs (unknown, omitted, corrected, older) so the demo panel in S-07 only wraps it.
- README documents the snapshot message contract next to the capacity update.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
