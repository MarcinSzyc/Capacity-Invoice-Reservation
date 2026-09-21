# ADR-0007: A treasury message with a different currency than the program

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-21
- Slice: S-02 (capacity update), S-06 (snapshot)
- Related: A-05, A-06, A-11, A-12, AC-20, AC-31, INV-08

## Context

Both treasury message types carry `currency` (A-11). The first message fixes the program's
currency (AC-20). A later message may carry another code, by mistake or because the treasury
really re-denominated the program. A-12 says a snapshot overwrites "limit and currency", but
`held` of every existing reservation is in the old currency and the service has no rate to
re-express it (A-02: rates come from clients per reservation). Silently accepting would add
amounts of two currencies (INV-08 forbids it).

## Options

### Option 1: Reject as unprocessable
The message is recorded `rejected` with reason `CURRENCY_MISMATCH`, dead-lettered with full
context, state unchanged, consumption continues. A human re-issues the message or migrates the
program. Simplest and safest.

### Option 2: Accept when the program has no active reservations, reject otherwise
A re-denomination while nothing is outstanding is harmless: limit and currency change, one
`limit_set` movement. With reservations outstanding, Option 1 applies.

### Option 3: Accept always and convert holds
Needs a rate the service does not have. Rejected on principle.

## Recommendation

Option 2. It keeps the door open for a legitimate re-denomination without inventing a rate,
and it costs one condition. Contract test (untagged, in S-02): update with another currency on
a program with a reservation is dead-lettered; on an empty program it is applied.

## Decision

Option 2, as recommended. Decided by Marcin on 2026-09-21.

A capacity update or snapshot whose `currency` differs from the program's is applied when the
program has no active reservation, and rejected when it has one.

- **No active reservation:** the program is re-denominated. Limit and currency are overwritten
  and one `limit_set` movement records it. Nothing held is in the old currency, so nothing has
  to be converted and no rate has to be invented.
- **At least one active reservation:** the message is recorded with outcome `rejected` and
  reason `CURRENCY_MISMATCH`, dead-lettered with its full context, and the program is left
  exactly as it was. Consumption continues with the next message (A-13). A human either
  re-issues the message or migrates the program deliberately.

The line is drawn at active reservations rather than at any history, because `held` is what
would have to be re-expressed, and only an active reservation holds anything. A released or
closed reservation holds nothing, so it cannot be made inconsistent by a currency change.

Option 1, rejecting always, was declined for costing a legitimate re-denomination on an empty
program for no gain: refusing a message we can apply correctly is not safety. Option 3,
converting holds, was declined on principle, because the service has no rate of its own
(A-02: rates arrive from clients per reservation) and inventing one would put a number in the
ledger that nobody can account for.

## Consequences

A-12's "currency is overwritten" is narrowed to "when no reservation is active"; `/spec` should
add that sentence to A-12 when this ADR is accepted (Changes row required). The rejection code
`CURRENCY_MISMATCH` joins the message outcome vocabulary and the glossary.
