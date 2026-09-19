# Testing strategy

Summary lives in `CLAUDE.md §4`. This page holds the reasoning and the details.

## Levels

| Level | File pattern | Runs in | What it proves | Infrastructure |
|---|---|---|---|---|
| unit | `src/**/*.test.ts` | `gate:quick` | domain rules, in isolation | none, `new` + in-memory fakes |
| integration | `src/**/*.integration-test.ts` | `gate:quick` | one module against real DB / Kafka | Testcontainers |
| e2e | `test/**/*.e2e-test.ts` | `gate` | one AC through HTTP, authenticated | full app + Testcontainers |
| invariant | tagged `[INV-xx]`, any level | `gate` | rule holds under concurrency / replay | as needed |
| contract | Kafka message tests, integration level | `gate:quick` | schema, idempotency, ordering, duplicates | Kafka container |
| cold start | `docker compose up` smoke | `gate` | "runnable locally" | Docker |

## Rules

- One e2e test per AC, tagged with its id. Unit tests may carry AC tags too when the
  behaviour is fully domain-level, but the e2e test is what closes the AC.
- Invariant tests run the critical section in parallel (Promise.all of N requests) and
  assert the aggregate, e.g. total reserved never exceeds the limit.
- Kafka contract tests replay the same message twice and assert state changed once.
- Fakes over mocks. A fake repository is a class with an array. Mock only third-party
  boundaries we do not own.
- No shared mutable state between tests. Each e2e test creates its own program.
- Fixtures: UPPERCASE constants at the top of the file.
- Flaky test = defect. Fix the cause or delete the test; never retry to green.

## Decisions pending (become ADRs)

- Testcontainers vs docker compose for test infrastructure
- How auth is exercised in e2e (real token issuance vs test-only credentials)
