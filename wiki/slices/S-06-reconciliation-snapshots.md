# S-06 Reconciliation snapshots

- Outcome: a treasury snapshot brings a program's limit and reservations up to date as of one moment, every difference is an explicit adjustment in the ledger, and nothing a client was already told is undone by an older snapshot.
- Status: planned
- AC: AC-26, AC-27, AC-28, AC-29, AC-30, AC-31
- INV: INV-05, INV-06, INV-07
- Risk: high. Reconciliation: comparing two systems' clocks, set differences between local and remote reservations, a correction that has to live alongside a `held` derived from the invoice (ADR-0009), monotonic application under shuffled delivery, replay of everything. Implemented on Fable per `CLAUDE.md §8`.
- Depends on: S-05. ADRs that must be accepted first: [[../decisions/ADR-0010-reconciliation-created-at-versus-as-of]], [[../decisions/ADR-0011-reconciliation-created-reservations]], [[../decisions/ADR-0012-snapshot-corrections-on-a-derived-held]]. ADR-0007 (accepted in S-02) governs the currency field.

## What the shipped code already gives this slice

Checked against `main` at c206c30, after S-05, rather than assumed:

- `reservations.source` is already a Postgres enum with both values, `client` and `reconciliation`; no migration for it.
- `programs.as_of` exists, `Program` carries `asOf`, the program repository and mapper persist it, and the availability mapper already returns it (null so far). AC-31 needs the value set, not a new field.
- `capacity_movements.message_id` exists, `CapacityMovement.attribution` already admits `{messageId}`, and the reservation read already renders `messageId` and a null `clientId` on a movement. The `adjustment` kind is in both the TypeScript union and the Postgres enum.
- `Ledger.recompute` chains on `deltaHeld` and special cases only `limit_set`, so adjustment rows, positive or negative, recompute with no change.
- `Program.reserve` refuses a zero `held` with a comment that names this slice: no path over Kafka may open a reservation closed at birth. The rule is kept (local decision 4).
- `Reservation.release` derives `held` from the remaining invoice amount (ADR-0009). This is what makes ADR-0012 necessary: a correction stored only in `held` is overwritten by the next release.
- The treasury consumer parses only `capacity_update` (`@Equals(CAPACITY_UPDATE_TYPE)` on the DTO), so a snapshot today is rejected as malformed. Dispatch by `type` is new.
- `ReservationRepository` has `findByInvoice`, `add`, `save`; `LedgerRepository` has `append` and `findByReservation`. Neither can list a program's active reservations or a program's movements since a moment. Both reads are new.
- `createdAt` and `occurredAt` are stamped by the `Clock` port (`SystemClock`), whose comment already names INV-06. The e2e app does not override it yet.

## Scope

Domain:
- `Snapshot` value: `messageId`, `asOf`, `currency`, `creditLimit`, `activeReservations: {invoiceId, heldAmount}[]` in program currency.
- A pure domain service `reconcile` (in `domain/reconciliation.ts`) that takes the locked program, the snapshot, the local reservations it concerns, each one's client movements after `asOf`, and the keep window (ADR-0010), and returns the reservation changes and the movements in a deterministic order. It is a function over values, so INV-06 and INV-07 are unit testable before any e2e exists. The rules, in order:
  - stale: `asOf` older than `program.asOf` changes nothing (AC-30, local decision 1);
  - currency: judged per ADR-0007 before anything else is applied (local decision 3);
  - limit: applied as a `limit_set` movement when `limitEventTime` is null or `asOf >= limitEventTime`, and `limitEventTime` becomes `asOf`; otherwise the limit part is skipped and logged while the reservation part still applies (INV-07 is per fact, local decision 2);
  - a local reservation created at or after `asOf` is untouched, listed or not (INV-06). Listed means a clock anomaly: keep local, log a warning;
  - a local active reservation created before `asOf - keepWindow` and not listed is dropped: `held` 0, `releasedInvoiceAmount` equal to `invoiceAmount` so it is closed (AC-27 as clarified 2026-09-25), one `adjustment` of minus its current `held`, whatever releases it had after `asOf`;
  - a local active reservation created in `[asOf - keepWindow, asOf)` and not listed is kept and logged as "kept within window" (ADR-0010);
  - a local reservation created before `asOf` and listed is brought to the snapshot's `held` as of `asOf`: the target is the listed `heldAmount` plus the signed `deltaHeld` of that reservation's client movements after `asOf`, floored at zero (ADR-0012, question 2). A difference is one `adjustment`; no difference, no movement;
  - a listed reservation that is closed locally is reopened or left, per ADR-0012 question 3;
  - an invoice only in the snapshot becomes a new `Reservation` with `source: reconciliation` per ADR-0011 (`createdAt` is the snapshot's `asOf`) and an `adjustment` of `+heldAmount`. A listed `heldAmount` of 0 for an unknown invoice creates nothing (local decision 4).
- `Reservation` gains `fromSnapshot`, `correctTo(targetHeld)` and `drop()`; `held` keeps its ADR-0009 derivation with the stored correction from ADR-0012 question 1. `Program` gains `adjust(deltaHeld, reservationId, messageId, occurredAt)`: signed, no capacity check (A-06: overcommit is legal here), `reserved` never below zero (INV-03).
- `SnapshotCurrencyMismatch` is the existing `CurrencyMismatchError`; no new error class.

Application:
- `ApplyReconciliationSnapshot` use case, the same shape as `ApplyCapacityUpdate`: one transaction, lock the program row (announce it if unknown, A-05), duplicate by `messageId`, then stale, then rejected (A-13 clause 5), read what `reconcile` needs, apply, persist reservations and movements, save the program with its new `asOf`, record the outcome. `rejected` returns to the consumer, which dead-letters first and records after, exactly as for a capacity update.

Infrastructure:
- `ReconciliationSnapshotMessageDto` for `type: 'reconciliation_snapshot'`: `{messageId, type, programId, currency, creditLimit, asOf, activeReservations: [{invoiceId, heldAmount}]}`, nested validation, `asOf` with a zone like `eventTime`, invoice ids unique within the list and within `INVOICE_ID_MAX_LENGTH`, at most `SNAPSHOT_RESERVATIONS_MAX` entries (local decision 5).
- The treasury consumer reads `type` first and dispatches to the matching parser and use case; an unknown `type` is rejected like any malformed message.
- `ReservationRepository.findActiveByProgram(programId)` and `findByInvoices(programId, invoiceIds)`; `save` also persists the correction column. `LedgerRepository.findClientMovementsSince(programId, since)` returns the `reserve` and `release` rows after a moment, in one query rather than one per reservation. Each gets an integration test and a fake in `in-memory-capacity.fake.ts`.
- Migration: `reservations.held_correction BIGINT NOT NULL DEFAULT 0` if ADR-0012 question 1 is decided as recommended. Nothing else: the enum values and `as_of` exist.
- `GET .../reservations/:invoiceId` shows `source: reconciliation` and `adjustment` movements with `messageId`; no new field (local decision 11).
- Availability `asOf` returns the last applied snapshot moment (AC-31); nothing to change in the mapper.
- Configuration: `RECONCILIATION_KEEP_WINDOW_SECONDS` if ADR-0010 is decided with a window.
- Dev tooling: `npm run dev:treasury -- snapshot --program PRG-1 --currency USD --limit ... --as-of ... --reservations INV-A:70000000,INV-B:0`, with `DevTreasuryProducer.publishSnapshot`.
- Test harness: `test/support/test-app.ts` gains a settable clock override for `CLOCK`, so AC-27, AC-28 and INV-06 use the times the criteria are written in (09:00, 18:00:30, 18:00) rather than offsets from the real clock.

## Local decisions

Recorded so `/review` can hold the code to them. None has alternatives worth an ADR; each one that
touches a spec word is listed under "Owed to `/spec`".

1. **A snapshot is stale when its `asOf` is older than the program's.** A-12's word is "older", and
   `Program.setLimit` already treats an equal time as not stale. An equal `asOf` applies again;
   since a correction sets a target rather than adding a delta, the same snapshot applied twice
   under two message ids produces no second movement.
2. **The limit is a fact of its own inside the snapshot.** INV-07 says both the applied `asOf` and
   the applied limit `eventTime` never decrease, which only makes sense if they are judged
   separately. A snapshot newer than the last snapshot but older than the last capacity update
   applies its reservations and skips its limit.
3. **Currency first, and a re-denomination needs the limit to apply.** ADR-0007 is judged on the
   local state before the snapshot: no active reservation means re-denominate, otherwise the
   message is `rejected` with `CURRENCY_MISMATCH` and nothing is applied, reservations included,
   because the listed amounts are in the snapshot's currency. A snapshot with another currency
   whose limit part would be stale is rejected too: the stored limit could not be re-expressed.
4. **A listed `heldAmount` of 0 is legal.** An active reservation may hold 0 since AC-15 was amended,
   so the treasury may say so. For a known reservation it is a correction to 0 that leaves the
   reservation active while the invoice still owes. For an unknown invoice nothing is created and
   a warning is logged: a reservation holding nothing would be closed at birth, which
   `Program.reserve` already refuses.
5. **The list is bounded and unique.** An invoice id listed twice is a malformed message, since the
   two amounts cannot both be true. At most `SNAPSHOT_RESERVATIONS_MAX` (10 000, in
   `identifier-limits.ts`) entries, so one snapshot is one bounded transaction; a larger one is
   rejected and dead-lettered, and the README says so.
6. **Adjustment rows are attributed to the message and ordered.** Each carries the snapshot's
   `messageId` and no `clientId` (INV-09), and `occurredAt` from the clock, the moment we applied
   it; `asOf` is on the program and in the message record. The `limit_set` row comes first, then
   adjustments in invoice id order, so the same snapshot writes the same ledger every time.
7. **Overcommit is legal after a snapshot** (A-06). `Program.adjust` has no capacity check; it only
   refuses a `reserved` below zero, which is INV-03.
8. **Only client movements count as "after `asOf`".** ADR-0012 question 2 sums `reserve` and
   `release` rows with `occurredAt` after `asOf`. Adjustment rows are left out: they belong to
   earlier snapshots, whose view this one replaces.
9. **The clock stays the `Clock` port.** Recommended in ADR-0010's revised text: it is what S-03
   shipped, and it is what lets the e2e tests set 09:00 without writing rows behind the API.
10. **A future `asOf` is not refused.** The treasury's clock is not ours to judge, and refusing
    would stall the program. One further than the keep window ahead of our clock is logged as a
    warning, because it makes every later snapshot stale until then.
11. **The correction is not on the API.** AC-19 lists the fields a reservation read shows; the
    `adjustment` movements already explain why `held` differs from the invoice converted at the
    rate.
12. **INV-07 compares state, not history.** Final state per program is limit, currency, `asOf`,
    `reserved`, `available`, and per invoice `held`, status and source. Not `invoiceAmount`,
    `reservedAmount` or `createdAt`, which record which snapshot a reservation was born from and so
    legitimately differ with delivery order, and not the ledger, which records the order itself.
13. **A replay changes one thing: the duplicate count.** INV-05's "unchanged" means balances and
    ledger rows; each replayed message's `duplicate_count` goes up by one, and the test asserts
    that too, so it proves the replays arrived.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-26] should add an unknown reservation from the snapshot with source reconciliation and an adjustment movement')` | e2e | snapshot lists `INV-X` 700 000; `GET` shows source `reconciliation`, `held` 700 000, one `adjustment` movement of +700 000 with the snapshot's `messageId` and a null `clientId`; availability down by 700 000 |
| `it('[AC-27] should release by adjustment a reservation created before asOf that the snapshot omits')` | e2e | settable clock at 09:00, reserve `INV-A`; snapshot `asOf` 18:00 omits it; `held` 0, `releasedInvoiceAmount` equal to `invoiceAmount`, status `closed`, one `adjustment` of minus the old `held`; availability restored |
| `it('[AC-28] should keep a reservation created after asOf that the snapshot omits')` | e2e | settable clock at 18:00:30, reserve `INV-C`; snapshot `asOf` 18:00 omits it; reservation unchanged, no movement after the reserve. The keep window does not bear on this case: it widens keeping before `asOf`, and 18:00:30 is after |
| `it('[AC-29] should correct held to the snapshot value with an adjustment for the difference')` | e2e | `INV-B` at 1 925 000, snapshot says 1 900 000; `held` 1 900 000, `adjustment` of minus 25 000. Then a partial release of 900 000 leaves `held` 1 000 000, not 1 025 000, which proves the correction survived (ADR-0012 question 1) |
| `it('[AC-30] should ignore a snapshot older than the last applied one and record it as stale')` | contract | 18:00 applied, then 12:00 arrives; ledger unchanged, `treasury_messages` outcome `stale` |
| `it('[AC-31] should set limit and currency from the snapshot and expose its asOf in availability')` | e2e | limit 7 000 000, `asOf` echoed in availability; same currency as the program (the mismatch cases are ADR-0007's untagged contract tests below) |
| `it('[INV-05] should leave every balance and ledger row unchanged when every message and request of a scenario is replayed')` | invariant (e2e) | scenario: capacity update, two reservations, a partial release, a snapshot, a limit change; record the ledger and balances; replay every Kafka message and every HTTP request with the same ids; ledger and balances identical, HTTP replays answer `409`, each message's duplicate count up by one (local decision 13) |
| `it('[INV-06] should never alter a reservation by a snapshot whose asOf precedes its creation')` | invariant (e2e) | settable clock; interleavings: a snapshot arriving after the reservation but describing a moment before it, listed and not listed, and a snapshot describing a moment after it; only the last may touch it |
| `it('[INV-07] should reach the same final state for shuffled and reversed message order as for in-order delivery')` | invariant (contract) | five capacity updates and three snapshots for one program, including one invoice listed, then omitted, then listed again, delivered in order, reversed and in three seeded shuffles into fresh programs; final state compared as local decision 12 defines it |

Supporting tests, untagged because they prove a decision rather than close a requirement:

| Test | Level | Proves |
|---|---|---|
| `it('should judge a listed reservation against its held at asOf, not after a later release')` | unit | ADR-0012 question 2 |
| `it('should leave closed a reservation the client fully released after asOf')` | unit | ADR-0012 question 3, the boundary |
| `it('should reopen a reservation closed before asOf that a later snapshot lists')` | unit | ADR-0012 question 3, if decided as recommended |
| `it('should keep an omitted reservation created within the keep window before asOf')` | unit | ADR-0010, if decided with a window |
| `it('should apply the reservations and skip the limit of a snapshot older than the last capacity update')` | unit | local decision 2 |
| `it('should create nothing for an unknown invoice listed with a held of zero')` | unit | local decision 4 |
| `it('should dead-letter a snapshot whose currency differs while a reservation is active')` | contract | ADR-0007 |
| `it('should re-denominate an empty program from a snapshot in another currency')` | contract | ADR-0007 |
| `it('should reject a snapshot that lists one invoice twice')` | contract | local decision 5 |
| `it('should list only the active reservations of one program')` | integration | the new repository read |
| `it('should return only client movements after the given moment')` | integration | the new ledger read, local decision 8 |

## ADR candidates

- [[../decisions/ADR-0010-reconciliation-created-at-versus-as-of]]: strict `createdAt < asOf` versus a keep window; which clock stamps `createdAt`. Recommendation revised on 2026-09-25: Option 2 rather than Option 3, because "listed wins" would alter a listed reservation created after `asOf`, which INV-06 forbids.
- [[../decisions/ADR-0011-reconciliation-created-reservations]]: what `invoiceAmount`, `invoiceCurrency`, `rate` and `createdAt` a reservation born from a snapshot carries, and how a client later releases it. Addendum 2026-09-25: `createdAt` is the snapshot's `asOf`.
- [[../decisions/ADR-0012-snapshot-corrections-on-a-derived-held]], new: how a correction survives a later release, what a listed reservation is compared against when the client released after `asOf`, and whether a listed reservation closed locally is reopened.

## Owed to `/spec`

Before `/review`, in their own PR, with Changes rows:

- A-12: the keep window (ADR-0010), the comparison "as of `asOf`" for listed reservations (ADR-0012 question 2) and the reopen rule (question 3), each once its ADR is accepted.
- Glossary `Held`: "reserve minus the sum of releases" becomes "plus adjustments". Glossary `Adjustment` gets ADR-0011's sentence. `Snapshot moment` mentions the window. A new entry for the correction column's word, if ADR-0012 question 1 is accepted as recommended, with a number example.

## Definition of done

Beyond `CLAUDE.md §9`:

- The dev treasury script can produce every snapshot case of the ACs (unknown, omitted, corrected, older) so the demo panel in S-07 only wraps it.
- README documents the snapshot message contract next to the capacity update, including the list bound.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-25 | plan | revised against the shipped S-05 code: ADR-0012 proposed, ADR-0010 recommendation revised, ADR-0011 addendum, thirteen local decisions, test names unchanged |
