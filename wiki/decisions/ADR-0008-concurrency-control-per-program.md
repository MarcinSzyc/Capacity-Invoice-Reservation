# ADR-0008: Concurrency control for reservations on one program

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-21
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

Option 1, as recommended: a pessimistic row lock on the program, taken as the first statement
of every writing transaction. Decided by Marcin on 2026-09-21, after the mechanism had been
explained on two requests arriving at the same moment and why the database, not the service,
is the arbiter of which one wins.

What that fixes for S-03 and every later slice:

- Every use case that writes to a program (reserve, release, capacity update, snapshot) runs in
  one `UnitOfWork.run` and calls `ProgramRepository.lockById` before it reads anything else.
  `lockById` is `SELECT ... FROM programs WHERE program_id = $1 FOR UPDATE`, one raw statement
  (ADR-0002). Writers on one program queue; writers on different programs never wait for each
  other. Plain reads, such as the availability endpoint, are never blocked.
- Under `READ COMMITTED`, a `FOR UPDATE` that had to wait returns the row as the winner
  committed it, so the second transaction judges the real state: with 500 000 available and two
  reservations of 500 000, exactly one gets `201` and the other gets `422 CAPACITY_EXCEEDED`
  with `available: 0` (AC-03), in one round trip and with no retry loop.
- Which of two simultaneous requests wins is decided by lock order at the database. That is
  arbitrary but consistent, and acceptable because the brief gives no client or invoice
  priority; a priority rule would need a queue, which is a different system.
- Lock order is fixed for every writer: the program row first, then the reservation row. Two
  transactions that lock in the same order cannot deadlock.
- The transaction is short: lock, check, write, commit. Nothing that waits on the network
  belongs inside it. The unit of work carries a timeout so a stuck transaction fails loudly
  instead of holding the program.
- INV-01 is proven by the S-03 test with parallel reservations against two application
  instances sharing one database, and by construction: the ledger's running balances are
  computed while the lock is held, so INV-04 needs no separate mechanism.

S-02 already built this shape: `PrismaUnitOfWork` opens the transaction, `lockById` is the
`FOR UPDATE` statement, the treasury consumer locks the program before applying a capacity
update, and an integration test shows a second unit of work waiting until the first commits.
Accepting Option 1 records what exists; S-03 adds reservations behind the same lock.

Considered and declined: an optimistic `version` column (Option 2) and `SERIALIZABLE` with
retry (Option 4) both turn the collision INV-01 tests for into retry loops in every use case,
buying speed this brief does not need; a conditional `UPDATE` (Option 3) covers the reserve
path in one statement but leaves releases, snapshots and the duplicate check to find their own
consistency, and would spread the rule across statements as the model grows.

## Consequences

Treasury messages use the same lock, so a snapshot for a program waits for in-flight
reservations on it and vice versa; that is the serialisation A-12 needs. If per-program
throughput ever matters, Option 3 for the reserve path is a local change behind the same use
case.
