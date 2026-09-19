# Invariants

Statements that must hold in every state, regardless of scenario or interleaving.
Each names the failure it guards against and how it is tested. Tagged `[INV-xx]` in tests.

**INV-01 Client operations never overcommit.** For every program, after any sequence of
reservations and releases from clients, `Σ held of active reservations ≤ limit`. Only a
treasury limit change or a reconciliation adjustment may make `reserved > limit`.
Guards against: two parallel reservations both seeing the same free capacity. Test: N
parallel reservations (N × amount > available) against one program; assert exactly the
right number succeed and the sum never exceeds the limit; repeat under two service
instances against one database. [A-04, A-06]

**INV-02 Held stays within bounds.** For every reservation, `0 ≤ held ≤ reservedAmount`.
Guards against: over-release, negative capacity. Test: unit property over random
sequences of releases; e2e AC-13, AC-15.

**INV-03 Program reserved equals the sum of holds.** `programs.reserved = Σ held of
active reservations` at all times. Guards against: cached balance drifting from detail.
Test: assertion run after every e2e scenario.

**INV-04 The ledger explains the state.** For every ledger row, `reserved_after` equals
the previous row's `reserved_after` plus this row's `delta_held`, and the state
recomputed from the first row equals the stored state of program and reservations.
Guards against: any bookkeeping bug, lost or double-applied movement. Test: full
recomputation after every e2e scenario; unit test of the chain rule. [A-15]

**INV-05 Reprocessing changes nothing.** Applying an already processed `messageId`,
`releaseId` or (program, invoice id) pair leaves every balance and every ledger row
unchanged. Guards against: Kafka redelivery, client retries after timeouts. Test: replay
every message and request of a scenario a second time; assert the ledger is identical.
[A-07, A-09, A-13]

**INV-06 Acknowledged reservations survive older snapshots.** A reservation created at
time `t` is never released or altered by a snapshot with `asOf < t`. Guards against:
reconciliation erasing a success already returned to a client. Test: interleave
reservations and snapshots with controlled timestamps, including a snapshot that arrives
after the reservation but describes a moment before it. [A-12]

**INV-07 Snapshot application is monotonic.** For every program, the applied `asOf`
never decreases, and the applied limit `eventTime` never decreases. Guards against:
out-of-order delivery reverting state. Test: deliver messages in reversed and shuffled
order; assert final state equals in-order delivery. [A-13]

**INV-08 Money is integer minor units with a currency.** No amount exists without a
currency; no arithmetic combines two currencies without a stored rate; no float
representation appears in the domain, storage or API. Guards against: rounding drift and
silent cross-currency addition. Test: type-level (a `Money` value object with no
cross-currency operations), unit tests for rounding half up, API schema tests.
[A-10]

**INV-09 Every movement is attributable.** Every ledger row carries either a `clientId`
(reserve, release) or a `messageId` (limit_set, adjustment), never neither. Guards
against: unexplained changes to capacity. Test: storage constraint plus unit test of each
use case.

**INV-10 Business endpoints are unreachable without a valid token.** Every route except
liveness, readiness, API docs (non-production) and the demo page (dev) answers `401`
without a valid token. Guards against: a route added without the guard. Test: e2e sweep
over the route list of the running application, asserting `401` for each business route
without a token. [A-14, A-16]

**INV-11 Available is bounded.** `0 ≤ available ≤ limit` for every program at all
times. Guards against: negative or inflated availability shown to clients. Test: unit
property over random event sequences including limit reductions.

## Changes

| Date | Id | Change | Where |
|---|---|---|---|
| 2026-09-19 | INV-01 to INV-11 | first version, output of the spec gate | PR #5 |
