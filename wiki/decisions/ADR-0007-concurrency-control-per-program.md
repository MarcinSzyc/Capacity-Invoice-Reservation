# ADR-0007: Concurrency control for reservations on one program

- Status: proposed
- Date: 2026-09-19
- Slice: S-03
- Related: A-04, A-06, INV-01, INV-03, INV-04

## Context

Two parallel reservations must never both succeed on the same free capacity, across several
service instances sharing one database (INV-01). A reservation is several writes in one
transaction: read the program, check capacity, insert the reservation, append a ledger row
with running balances, update `programs.reserved`. Releases and treasury messages write the
same rows. Throughput per program in this brief is low (invoice approvals, not ticks). A-04
already recommends a pessimistic row lock; this ADR records the alternatives and the choice.

## Options

### Option 1: Pessimistic row lock, `SELECT ... FROM programs WHERE program_id = $1 FOR UPDATE`
Every writer on a program (reserve, release, capacity update, snapshot) starts by locking the
program row inside its transaction. Writers on one program queue; writers on different
programs run in parallel. Pros: simple to reason about, the ledger's running balances are
computed under the lock so INV-04 holds by construction, no retry loop. Cons: a lock held
across the whole transaction; a slow transaction delays the others on that program.

### Option 2: Optimistic concurrency with a `version` column
Read, compute, `UPDATE ... WHERE version = $seen`; on zero rows, retry. Pros: no waiting
under low contention. Cons: retry loops in every use case, the ledger row must be written
after the successful update, INV-01 under 25 parallel requests means many retries.

### Option 3: Conditional update, `UPDATE programs SET reserved = reserved + $x WHERE reserved + $x <= credit_limit`
Atomic capacity check in one statement. Pros: fastest. Cons: the ledger row's
`reserved_after` must be read back in the same transaction (needs `RETURNING`, fine) but
releases, snapshots and the duplicate check still need their own consistency story; the
approach spreads across statements as the model grows.

### Option 4: `SERIALIZABLE` isolation with retry on serialisation failure
Pros: correctness by the database. Cons: retries under contention, harder to test
deterministically, unusual in application code.

## Recommendation

Option 1, exactly as A-04 recommends. One `UnitOfWork.run` with `ProgramRepository.lockById`
as the first statement of every writing use case, lock ordering fixed (program first, then
reservation) so no deadlock is possible, and a statement timeout so a stuck transaction fails
loudly. INV-01 proves it with two application instances.

## Decision

(empty until Marcin decides)

## Consequences

Treasury messages use the same lock, so a snapshot for a program waits for in-flight
reservations on it and vice versa; that is the serialisation A-12 needs. If per-program
throughput ever matters, Option 3 for the reserve path is a local change behind the same use
case.
