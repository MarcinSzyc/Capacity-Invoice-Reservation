# Slices

One file per slice, `S-xx-<slug>.md`, written by `/plan`. A slice is a coherent group of
acceptance criteria and invariants delivered through every layer, so that after it ships a
client can do something new. Status and the `Log` section at the end of each file are
updated by implement, verify, review and ship. Requirement-level status is in
[[../plan/plan]].

## Order

Execution order with risk and dependencies, kept by `/plan`; status kept by `/ship`.

| Slice | Title | Risk | Depends on | AC / INV | Status |
|---|---|---|---|---|---|
| [[S-01-walking-skeleton]] | Walking skeleton | low | none | AC-00, AC-41 | done |
| [[S-02-programs-from-the-treasury]] | Programs from the treasury | medium | S-01 | AC-20, AC-23, AC-24, AC-25, AC-32, AC-33, AC-35, AC-36, AC-37, AC-40, INV-10 | done |
| [[S-03-reservations-and-capacity-invariant]] | Reservations and the capacity invariant | high | S-02 | AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-09, AC-21, AC-22, INV-01, INV-03, INV-04, INV-09, INV-11 | done |
| [[S-04-cross-currency-reservations]] | Cross-currency reservations | high | S-03 | AC-06, AC-07, INV-08 | done |
| [[S-05-releases]] | Releases | high | S-04 | AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-34, INV-02 | planned |
| [[S-06-reconciliation-snapshots]] | Reconciliation snapshots | high | S-05 | AC-26, AC-27, AC-28, AC-29, AC-30, AC-31, INV-05, INV-06, INV-07 | planned |
| [[S-07-demo-and-operations]] | Demo page and operations | low | S-06 | AC-38, AC-39 | planned |

## Why this order

S-01 exists so that everything after it can be verified by one green gate. S-02 comes next
not because it is risky but because nothing else can start without it: programs originate
from the treasury (A-05), so the Kafka consumer, the persistence model, authentication and
the availability read are the price of admission for every business slice, and putting the
cold start (AC-36, AC-37) here makes the gate's smoke hit an authenticated endpoint from the
second slice on. S-03 is the highest-risk slice of the brief, the never-overcommit invariant
under parallel clients and two service instances, and it runs as early as its dependencies
allow. S-04 isolates the money arithmetic (decimal rate, half-up rounding, no float) so that
S-05, releases in invoice currency with exact closing and idempotency, builds on a proven
`Money.convert`. S-06, reconciliation, is the second-highest risk but needs releases first:
its hardest cases are snapshots that disagree with a partially released reservation, and its
tests observe adjustments through the reservation read endpoint that S-05 delivers. S-07 is
last because A-17 says so and because the demo only wraps what already works. Four of seven
slices are `high` and run on Fable; the two `low` ones and the `medium` foundation run on
Opus.
