# ADR-0013: A treasury message that fails the same way every time

- Status: accepted
- Date: proposed 2026-09-25, accepted 2026-09-25
- Slice: S-06
- Related: A-13, AC-25, ADR-0003, ADR-0007

## Context

A-13 clause 4 says a malformed or unprocessable message is logged, dead-lettered and consumption
continues, because "one bad message must not stall other programs". The consumer does that for
two known cases: a message that fails validation, and a `CURRENCY_MISMATCH` rejection. Every
other error propagates on purpose: the offset stays uncommitted and Kafka delivers the message
again. That is right for a database or broker that is away for a moment, and it is how S-02 made
an outage lose nothing.

It is wrong for an error that will happen again on every delivery. Then the message is
redelivered forever, and because one partition is consumed in order, every later message on it
stops, other programs included. Review round 1 of S-06 reproduced two such errors with valid-looking
input: a list entry that was an array crashed the parser, and a list whose total overflowed a
`BIGINT` column. Both are fixed one by one in S-06, and a third was the old INV-02 CHECK. Each fix
closes one door; the class stays open for the next unforeseen one.

## Options

### Option 1: Keep propagating, fix causes as they are found
No change to the consumer. Every permanent failure found gets its own validation or rule. Cons:
the next one found in production stalls a partition until someone deploys a fix, which is exactly
the outage A-13 exists to prevent.

### Option 2: Name the permanent errors, dead-letter those
Catch a list of errors known to be permanent (a domain `RangeError`, database constraint and
value-out-of-range errors) and treat them as rejections. Everything else still propagates. Cons: an
error nobody listed still stalls the partition; the list is the weak spot and only grows after an
incident.

### Option 3: Name the transient errors, dead-letter everything else
Invert the list: the errors that mean "try again later" are named (the database or broker cannot be
reached, a connection dropped, the pool or a transaction timed out, a serialisation conflict or
deadlock), and those propagate so the message is delivered again. Any other error is recorded
`rejected` with the error text, dead-lettered with its context, logged at error level, and
consumption continues. Cons: an unlisted transient error sidelines a valid message to the
dead-letter topic instead of retrying it; it is visible there and can be re-published. Recording
the rejection needs the database, so when the database is itself the problem the record fails and
the error propagates, which is the transient path again.

### Option 4: Bounded retries, then dead-letter
Retry any error a fixed number of times, then dead-letter. Cons: the count has to live somewhere.
In memory it resets on every restart, so a crash loop never reaches the bound; in the database it
cannot be written while the database is the thing that is down, and then an outage longer than the
bound would dead-letter valid messages.

## Recommendation

Option 3. The two failure modes are not symmetric: a stalled partition stops every program on it
and is invisible until someone notices the lag, while a sidelined message is one program's, sits in
the dead-letter topic with its error in the headers, and can be replayed. Naming what is transient
is also the shorter, more stable list, because it is about infrastructure being away, not about
what a message may contain. Contract test: a message whose handling throws an unlisted error is
dead-lettered and the next message on the same partition is applied; one whose handling throws a
"database unreachable" error is delivered again.

## Decision

Option 4, bounded retries, in the form below. Decided by Marcin on 2026-09-25: "try to process it
three times, then record somewhere that there was an error and move on".

- **Three attempts inside one delivery.** When applying a message throws anything other than the
  rejections the consumer already knows (validation, `CURRENCY_MISMATCH`), it is tried again after
  a short pause, up to three attempts in all. Each attempt is its own transaction, so a failed one
  leaves nothing behind.
- **Then it is a rejection like any other.** After the third failure the message is dead-lettered
  with the last error in its headers, recorded against its `messageId` with outcome `rejected` and
  the error text, logged at error level, and consumption continues with the next message. The
  dead-letter topic and the message record are the "somewhere" the error is kept.
- **An outage still redelivers.** Giving up needs the broker for the dead letter and the database
  for the record. If either is away, that step fails, the error propagates, the offset stays
  uncommitted and Kafka delivers the message again, starting a fresh count of three. So a database
  that is down for an hour delays the treasury's messages but does not sideline them; only a
  message that fails three times while both are up is set aside.

The counting lives in the handler, not in storage: that is what answers Option 4's objection. A
count kept across deliveries would reset on every restart in memory, and could not be written in
the database while the database is what is failing.

Option 3, naming the transient errors, was the recommendation and was declined for a simpler rule
that does not depend on keeping a list of infrastructure errors right. Option 2 was declined because
an error nobody listed would still stall the partition, and Option 1 because the next unforeseen one
would stall it until a deploy.

## Consequences

A-13 clause 4 gains a sentence: a message whose handling fails three times in a row, while the
database and the broker can record that, is treated as unprocessable (Changes row via `/spec`).
A flapping database that is back only for the moment of recording can set a valid message aside;
it is then in the dead-letter topic with its error and can be re-published. The consumer gets one classification function, which is
the thing to review when a new infrastructure error appears. The glossary's `Rejected` entry says
a rejection can also come from an unexpected failure, with the error recorded.
