# Assumptions register

Decisions that fill gaps in [[brief]]. Each entry is a decision Marcin made or
confirmed; the agent never adds one on its own. Ids are stable. A changed assumption
gets a new entry and the old one is marked `superseded by A-xx`.

Format: statement, rationale, consequence for design, what changes if it is wrong.

---

## A-01 Reservations do not expire

- Status: accepted 2026-09-18
- Source: [[open-questions]] Q10

**Statement.** A reservation lives from the moment it is created until its `held`
reaches zero through releases. There is no time-to-live, no scheduler, no `expired`
state. An approval that never led to a payout is closed by the client explicitly with
a release carrying `reason: cancelled` (see Q09).

**Rationale.** In invoice financing a reservation exists because money left the
financier. That money comes back when the buyer repays, never because time passed.
Expiry would make sense only in a two-step model (a hold before payout) which we do not
have. Expiring on a clock would also break two things we care about:

- a release arriving after expiry would hit a reservation with no `held`, while the
  financier's money was in fact still outstanding; available would have been
  overstated in the meantime and another invoice may have taken the slot, so the
  program would be overcommitted without us noticing (violates the core invariant);
- a reconciliation snapshot listing the "expired" invoice as active would re-add it as
  an adjustment, the next expiry would remove it again, and the ledger would fill with
  meaningless corrections.

**Consequence.** No clock dependency in the domain model, no background job, four
movement kinds in the ledger (`limit_set`, `reserve`, `release`, `adjustment`) and no
fifth. Tests need no time travel for reservation lifecycle.

**If wrong.** If a real treasury does treat unpaid approvals as lapsing after a period,
the cheapest safe addition is an informational `expectedRepaymentDate` on the
reservation and an "overdue" marker in the availability read, so a human can act. An
automatic expiry would need its own ADR covering precedence against releases and
snapshots.

## A-02 The conversion rate comes from the client, in the reservation payload

- Status: accepted 2026-09-18
- Source: [[open-questions]] Q12, also settles Q13 in part

**Statement.** When the invoice currency differs from the program currency, the
reservation request carries `rate` (invoice currency to program currency). We compute
`reservedAmount = invoiceAmount × rate`, round per Q14, store the rate on the
reservation and never change it. Releases are expressed in invoice currency and
converted with the stored rate. Validation: different currencies require a positive
`rate` (400 otherwise); same currency requires `rate` absent or equal to 1. The service
has no rate source of its own.

**What the brief says.** Only: "Programs and invoices may be denominated in
different currencies." Nothing about the source of rates. Every option below is
consistent with the text; the choice is entirely ours.

**Options considered.**

| Option | How it would work | Why not (or why) |
|---|---|---|
| (a) Config rate table behind a `RateProvider` port | Rates from a file or environment; swap the adapter later | Works offline and is cheap, but pretends the service knows the market. Every reservation would be booked at a rate the treasury never used, so each snapshot would produce FX adjustments. |
| (b) Rates from the treasury over Kafka | Either inside the periodic snapshot or as a separate `rates.updated` stream | In the snapshot the rate is as stale as the reconciliation period, so a 15:00 reservation would use a morning rate. A separate stream is a third message type the brief never mentions, plus a rate table in our database. The snapshot's `heldAmount` cannot be reversed into a per-invoice rate either, since `held` shrinks with releases. |
| (c) External market API (ECB, commercial feeds) | Call an API at reservation time, with cache and fallback | Market rates are indicative; the party that actually exchanges money (the treasury) books at its own desk rate or fixing, often with an FX buffer. Also breaks "runnable locally" without network and API keys. |
| (d) Rate supplied by the client in the payload | The platform already agreed the payout with the treasury and knows the rate; we book what we receive | Chosen. The rate arrives at the exact moment the reservation is created, from the party that talks to the treasury about that specific payout. No network, no invented messages, no assumption about how often anything happens. |

**Rationale for (d).** In invoice financing the platform presents the supplier an early
payment offer in a concrete amount before calling us, so it must know the rate already.
The treasury is the source of truth for FX; the client is its messenger. We book what we
receive, exactly as we do with limits.

**Consequence.** No `RateProvider`, no rate table, no `RATE_UNAVAILABLE` error. Q13
reduces to ISO 4217 validation. Q14 (rounding) still applies because we perform the
multiplication. The README must show `rate` in the example request for a cross-currency
reservation.

**If wrong.** If the client cannot know the rate, reintroduce a `RateProvider` port with
a treasury-fed adapter (option b, separate stream) and make `rate` optional with the
provider as fallback. The reservation model already stores the rate, so nothing
downstream changes.

## A-03 The service does not publish its own events to Kafka

- Status: accepted 2026-09-18
- Source: [[open-questions]] Q19

**Statement.** Kafka is an input only. We consume capacity updates and reconciliation
snapshots from the treasury; we publish nothing. Clients learn about state through the
HTTP API.

**What the brief says.** It names three capabilities (accept reservations, process
releases, expose availability) and mentions Kafka solely as the channel capacity data
"flows in" from. Publishing is not asked for.

**Why it would be useful later.** Outbound events such as `reservation.created`,
`reservation.released` and `program.capacity.changed` would let the treasury reconcile
against us in both directions, let the client platform stop polling availability, and
feed reporting or alerting without database access.

**Why not now.** It adds a producer, a contract for our own messages, a delivery
guarantee decision (the "saved to the database but crashed before publishing" problem,
normally solved with an outbox table) and tests for all of it. Real work that the
brief does not reward and that would take time from concurrency and reconciliation,
which it does.

**Consequence.** No producer, no outbox, no outbound message contract. The ledger of
capacity movements already is the event stream we would publish, so adding publication
later is one adapter reading movements and sending them, with no change to the domain.

**If wrong.** If a consumer needs our events, add an outbox table written in the same
transaction as the movement and a relay to Kafka; this is a new slice and an ADR, not a
redesign.

## A-04 Kafka is the treasury's inbound channel, not our request queue

- Status: accepted 2026-09-19
- Source: discussion of the system boundary; relates to Q01, Q15, Q17, Q28

**Statement.** The service has two inbound edges of different nature:

| Edge | Who | Channel | Nature |
|---|---|---|---|
| reserve, release, availability | client | HTTP | synchronous, answered immediately with accept or reject |
| capacity update, reconciliation snapshot | treasury | Kafka | asynchronous, consumed, never answered |

We do not publish client requests to Kafka and process them from a queue. A reservation
is decided inside the HTTP request and the client leaves with the answer.

**What the brief says.** "Capacity data also flows in from an external treasury
system via Kafka": Kafka is the channel an external system uses to reach us. "All
endpoints must be authenticated" and "accepting reservations, processing releases, and
exposing current availability to clients": clients use HTTP endpoints and expect an
answer.

**Option rejected.** Kafka as an internal queue for everything: the endpoint enqueues the
request, a consumer processes reservations, releases and snapshots FIFO, the client gets
202 and polls for the outcome. Rejected because it removes the immediate accept-or-reject
answer the brief implies by "real time", it mixes two sources of different authority
(client requests and treasury facts) in one stream, and it is a different system from
the one described.

**What is right in the queue intuition.** Operations on one program must be serialised:
two parallel reservations must never both succeed on the same free capacity. We get that
from the database, not from a queue. Every reservation and release runs in one
transaction that first locks the program row (`SELECT ... FOR UPDATE` or an equivalent
the chosen engine offers). Concurrent requests on the same program wait for the lock and
each sees the state the previous one left; requests on different programs run in
parallel. This is serialisation, not strict arrival order, and serialisation is what the
invariant needs. Treasury messages are consumed in order per program because the
partition key is `programId`.

**Consequence.** No producer, no internal topics, no polling endpoint for outcomes.
Concurrency is proven by an invariant test that fires many parallel reservations at one
program and checks that `reserved` never exceeds the limit. The locking mechanism
(pessimistic row lock, optimistic `version`, or conditional update) is an ADR in the
plan; the recommendation is the pessimistic row lock because a reservation is several
writes in one transaction and the per-program throughput in this brief is far below
where the lock would become a bottleneck.

**If wrong.** If a client cannot wait for a synchronous answer, an asynchronous
reservation endpoint returning 202 with a status resource can be added beside the
synchronous one, backed by the same use case. The domain does not change.

## A-05 Programs originate from the treasury

- Status: accepted 2026-09-19, interpretation of Marcin's note on Q01 (confirm wording)
- Source: [[open-questions]] Q01

**Statement.** A program comes into existence when the first treasury message about it
arrives (a capacity update or a reconciliation snapshot). The treasury sets and changes
the credit limit; the service never lets a client create a program or change a limit.
For local development the demo page and the dev producer send an initial capacity update
that creates a sample program with a 10 000 000 limit, mirroring the brief's example.

**Rationale.** The brief says capacity data flows in from the treasury. One write
path for program facts keeps one source of truth. Marcin's note: "at the start we have
10 million, later the treasury; allow the bulk sync to update the total".

**Consequence.** No program-management endpoints. A reservation for an unknown program is
`404 PROGRAM_NOT_FOUND`. The dev producer is part of "runnable locally".

**If wrong.** If programs must be creatable by an operator, add an authenticated admin
endpoint that emits the same internal command a capacity update does.

## A-06 Available capacity is derived from three kinds of events; overcommit is possible

- Status: accepted 2026-09-19, amended 2026-09-21 (the limit may be zero)
- Source: Q02, Q03, Q04

**Statement.** `available = limit − reserved`, floored at zero, where `reserved` is the
sum of `held` of active reservations. Only three things change it: a limit set by the
treasury, a reservation, a release. Reconciliation produces the same kinds of events as
adjustments; there is no separate "external usage" figure. A reservation equal to the
remaining capacity is allowed (`held ≤ available`). The treasury may lower the limit
below current usage; the program becomes overcommitted, `available` reads zero, new
reservations are rejected, existing ones stay valid. Limit, reserved and available are
all exposed so a client can see overcommitment. The limit may be lowered all the way to
zero: a program with a zero limit is frozen, nothing new can be reserved on it, and every
existing reservation keeps its `held` (amended 2026-09-21).

**Rationale.** Every unit of money outstanding has an invoice behind it, so anything the
treasury knows can be expressed as reservations. Refusing a treasury limit would make our
state diverge from the source of truth.

**Consequence.** One formula, one ledger. Overcommit is a legal state that only treasury
events can create. Invariants INV-01 and INV-04.

## A-07 One reservation per invoice per program; duplicates are errors with stable codes

- Status: accepted 2026-09-19
- Source: Q05

**Statement.** The pair (program, invoice id) is unique. A second reservation request
for the same pair never creates anything and is answered `409 RESERVATION_ALREADY_EXISTS`
with the existing reservation in the body, whatever the amount. Capacity shortage is
`422 CAPACITY_EXCEEDED` with the current available amount in the body. Every business
error carries a stable machine-readable code next to the HTTP status.

**Rationale.** Retries after timeouts are normal; the client must be able to tell "no
room" from "you already have this" without parsing text. A duplicate is reported as an
error rather than a silent success because it signals an anomaly on the client side
(Marcin's decision, consistent with A-09).

**Consequence.** Unique constraint in storage; the reserve use case returns typed
outcomes mapped to codes in one place.

## A-08 Releases may be partial, are expressed in invoice currency, and carry a reason

- Status: accepted 2026-09-19
- Source: Q06, Q07, Q09

**Statement.** A release reduces a reservation's `held`. Several releases may follow
until the whole invoice has been released. A full repayment is a release of 100% of what
is left. The amount is optional: absent means "release everything left". The amount is
expressed in invoice currency and converted with the rate stored on the reservation;
`held` is derived from what the invoice still has to give back rather than decremented per
release (ADR-0009), so the final release closes the reservation exactly and rounding never
strands a minor unit. A release larger than what the invoice has left is
`422 RELEASE_EXCEEDS_HELD`, judged in invoice currency: judging it against `held` would let
a release that is legal in invoice terms fail on a rounding boundary. A release carries an optional
`reason`, `repaid` (default) or `cancelled`; the reason is recorded on the ledger
movement and changes no rule.

**Rationale.** The brief says only "when repaid, the amount is released back";
partial repayment is an assumption from practice (invoices are paid in instalments).
Full repayment is a subset, so supporting partial costs one amount field. `cancelled`
gives the ledger the distinction the treasury makes (money returned vs money never paid
out) for one enum field.

**Consequence.** `held` is a decreasing counter, not a flag. Proportional conversion and
last-instalment closing need dedicated tests.

## A-09 Release idempotency by `releaseId`

- Status: accepted 2026-09-19
- Source: Q08

**Statement.** Every release carries the client's identifier of the repayment
(`releaseId`). Outcomes: unknown reservation `404 RESERVATION_NOT_FOUND`; a new
`releaseId` on a reservation with nothing left to release is `409
RESERVATION_ALREADY_RELEASED`, which is not the same as `held` reaching zero, because a
remainder worth less than half a minor unit of the program currency rounds `held` away
while the invoice still owes (AC-15, amended 2026-09-24); a
`releaseId` already processed is `409 RELEASE_ALREADY_PROCESSED` with the original
outcome (when applied, `held` after) in the body and no state change.

**Rationale.** With partial releases two identical instalments are legal, so the
invoice id alone cannot tell a retry from a second payment. Same policy as A-07:
duplicates are errors, never silent successes.

## A-10 Capacity is held in program currency; ISO 4217 codes; round half up

- Status: accepted 2026-09-19
- Source: Q11, Q13, Q14

**Statement.** Reservations convert once, at creation, to program currency using the
client-supplied rate (A-02); `reservedAmount` and `held` are in program currency.
Currency codes are normalised to upper case at every boundary, before validation and
before the domain sees them, and then validated as ISO 4217 syntactically: `usd` is
accepted and read as `USD` on an HTTP reservation request and on a treasury capacity
update alike. The normalisation is part of the published contract, so the description of
every currency property in the OpenAPI document says the value is uppercased. A code that
is not three letters, or three letters that are not an ISO 4217 code, is still refused
(AC-08). Same-currency reservations need no rate. Converted amounts are rounded half up
to the minor unit of the program currency. Amounts are integers in minor units
everywhere; no floats.

A currency's minor unit is the one ISO 4217 gives it, not always two decimals: JPY has
none, KWD has three, most codes have two. A conversion therefore scales by the difference
between the two currencies' exponents, so 1 000 JPY (1 000 minor units) at `0.0067`
becomes 670 USD minor units (6.70), not 7 minor units. The list of exceptions is small,
about twenty five codes, and a code the list does not name has two.

The rate a client sends is read back in canonical form: trailing fractional zeros are
dropped and an integer rate has no fractional part, so `"1.10"` reads `"1.1"` and a
same-currency reservation reads `"1"`. Rates compare numerically (ADR-0006), so `"1"`,
`"1.0"` and `"1.00"` are the same rate; the canonical form is what the API returns, and
the OpenAPI description of `rate` says so.

**Rationale.** One currency per program keeps the limit comparison trivial. Half up is
the conventional, predictable choice; the difference from any other rule is at most one
minor unit per reservation and is documented rather than ignored. Casing is normalised
rather than refused because the two boundaries cannot refuse alike: the HTTP edge can
answer a client `400`, but the Kafka edge has no one to answer, so a treasury message
refused over a casing difference becomes a dead letter for a code that is otherwise
correct. Leaving each edge to its own rule is what actually hurt: a program announced as
`usd` compares by `===` against every correct `USD` reservation and answers
`CURRENCY_MISMATCH` forever, so the program can never be used. One rule, applied at both
boundaries, removes both failures. The minor unit exponent is a fact about a currency
code, so treating every currency as two decimals would book a JPY invoice a hundred times
too small and a KWD one ten times too large; the alternative, refusing any currency
outside the two decimal codes, would answer a stable error code for a limitation rather
than a rule. The rate is canonicalised rather than echoed exactly because keeping the
scale a client happened to type would mean storing it for presentation only, and two
rates that are numerically equal already count as one rate everywhere else.

**If wrong.** If a real treasury contract turns out to be case sensitive and expects us
to reject rather than repair a lower case code, the normalisation moves from the two DTO
boundaries to a rejection at each, and a treasury message carrying `usd` becomes a dead
letter. The domain is unaffected either way: it only ever sees an upper case code. If a
client turns out to need the rate echoed exactly as it was sent, the sent scale has to be
stored next to the rate and rendered from there; the stored rate itself does not change,
because it is already exact.

## A-11 The treasury message contract is defined by us

- Status: accepted 2026-09-19
- Source: Q15

**Statement.** No contract is given, so we define two message types, keyed by
`programId`, with `messageId` and an event time on each:

- capacity update: `programId`, `currency`, `creditLimit`, `eventTime`
- reconciliation snapshot: `programId`, `currency`, `creditLimit`, `asOf`,
  `activeReservations[]` of `{invoiceId, heldAmount}` in program currency

Amounts in minor units. The schema is validated on consumption; a message that fails
validation is rejected (A-13).

**If wrong.** A real treasury contract replaces the two DTOs and their validators; the
commands they produce for the domain stay.

## A-12 Reconciliation is a comparison against the snapshot moment, never a wholesale replace

- Status: accepted 2026-09-19, amended 2026-09-21 (a currency change needs an empty program,
  ADR-0007), amended 2026-09-25 (keep window, comparison as of `asOf`, reopen; ADR-0010,
  ADR-0011, ADR-0012)
- Source: Q16

**Statement.** A snapshot describes a program at `asOf` and says nothing about what
happened after. Applying it: the limit is overwritten; the currency is overwritten only
when the program has no active reservation, and a message carrying a different currency
while at least one reservation is active is rejected instead, leaving the program exactly
as it was (ADR-0007); reservations created after `asOf` are kept untouched; for reservations created before `asOf`, one present in
both sets stays (a differing `held` becomes an adjustment), one only in the snapshot is
added as a reservation with source `reconciliation`, one only local is released by
adjustment. A snapshot whose `asOf` is older than the last applied one for that program
is ignored. Every difference is a ledger movement of kind `adjustment` pointing at the
message that caused it.

**Rationale.** Wholesale replacement would delete a reservation the client already got a
success for, violating "real time" and the core invariant. Marcin: "order and time
matter".

**Consequence.** Reservations carry `createdAt` compared against `asOf`; two systems'
clocks are compared. ADR candidate in the plan: tolerance window or "when in doubt keep",
since keeping a reservation is safer than releasing it.

Amended 2026-09-21, after ADR-0007 was accepted. The statement said limit and currency are
overwritten, full stop. That is only safe on a program with nothing outstanding: `held` of an
active reservation is in the old currency, and the service has no rate of its own to
re-express it (A-02: rates arrive from clients, per reservation). So a currency change is
applied to an empty program as a re-denomination, and refused otherwise with reason
`CURRENCY_MISMATCH`, which is a rejection recorded against the message rather than a failure
that stops consumption (A-13). The limit alone is still overwritten in every case.

Amended 2026-09-25, after ADR-0010, ADR-0011 and ADR-0012 were accepted in the S-06 plan. The
statement compares `createdAt` with `asOf` and a local `held` with the snapshot's, and says
nothing of how. Four rules fill that in; the example program is `PRG-1` in USD.

- **A keep window before `asOf`** (ADR-0010). A local reservation missing from the snapshot is
  released by adjustment only when it was created more than the window before `asOf`, default
  30 s. Created within the window, it is kept and the keep is logged: two clocks are compared,
  and a wrongly kept reservation is fixed by the next snapshot while a wrongly released one
  frees capacity another invoice may take. The window only widens keeping. A reservation
  created at or after `asOf` is untouched whether the snapshot lists it or not (INV-06), and a
  listed reservation created before `asOf` is compared whatever the window.
- **A reservation the snapshot creates** (ADR-0011) has `invoiceAmount` equal to the listed
  held amount, in program currency, at rate 1, and `createdAt` equal to the snapshot's `asOf`,
  since that is when the treasury knew it. A listed held amount of 0 for an unknown invoice
  creates nothing.
- **A listed reservation is compared as of `asOf`** (ADR-0012). The snapshot says nothing about
  what happened after its moment, so a client's releases after `asOf` stand. Example: `INV-B`
  held 1 925 000 at 18:00, the client released 500 000 at 18:05, and a snapshot of 18:00 lists
  it at 1 900 000. The treasury's figure after that release would be 1 400 000; `held` is
  1 425 000, so the adjustment is minus 25 000, the difference the treasury actually saw. A
  correction stays in force through later releases.
- **A listed reservation that is closed is reopened** (ADR-0012) when it was closed at or before
  `asOf`, with `held` set to the listed amount. When the client's release that closed it came
  after `asOf`, it stays closed: that repayment is newer than the snapshot.

Amended again 2026-09-25, from review round 1 of S-06, for two currency cases the rules above
left open. Both follow ADR-0007: nothing in one currency is ever turned into another without a
rate.

- **A snapshot in another currency whose limit is stale is refused** with `CURRENCY_MISMATCH`,
  even on a program with no active reservation: its limit is older than the last capacity update,
  so it cannot be applied, and the stored limit would stay in the old currency.
- **A listed reservation in another currency than the snapshot is skipped** and logged. That is a
  closed reservation from before a re-denomination, in the old currency; reopening it would mix
  two currencies in one program. The rest of the snapshot applies. Such a listing no longer stops
  a re-denomination either, since only an active reservation holds anything in the old currency.

## A-13 Kafka messages are deduplicated, staleness-checked, ordered per program, dead-lettered on failure

- Status: accepted 2026-09-19, amended 2026-09-21 (order of the checks), amended 2026-09-25
  (three attempts, equal `asOf`)
- Source: Q17, Q18

**Statement.** (1) A `messageId` already processed is a silent no-op. (2) A fact whose
event time is older than the latest applied fact of that kind for the program does not
overwrite state. (3) Messages are keyed by `programId`, so Kafka delivers them in order
per program. (4) A malformed or unprocessable message is logged with full context,
published to a dead-letter topic, and consumption continues. Deduplication and the
resulting movements are written in one transaction. (5) The checks run in the order
written: a known `messageId` is a duplicate first, whatever its body says, so a repeat that
is malformed or would be refused is counted and not dead-lettered; a stale fact is stale
before anything in it is judged, so a stale update carrying another currency is recorded
`stale`, not `rejected` (amended 2026-09-21, after review rounds 3 and 4 of S-02). (6) A message
whose application fails for any other reason is tried up to three times in one delivery; after the
third it is unprocessable in the sense of (4), and each failed try is kept with its error. While
the database or the broker is down that cannot be recorded, so the message is delivered again
instead (ADR-0013). (7) Two snapshots of the same program with the same `asOf` describe the same
moment; the treasury is expected not to send two that differ, and if it does, the later one
delivered is applied (amended 2026-09-25, from review round 1 of S-06).

**Rationale.** Kafka does not promise exactly-once or cross-partition order; the
treasury may republish. One bad message must not stall other programs.

## A-14 Bearer JWT; any authenticated client may act on any program

- Status: accepted 2026-09-19
- Source: Q20, Q21

**Statement.** Every business endpoint requires a bearer JWT validated by the service
against a configured secret or key set. The token's subject is recorded as `clientId`
on every movement. Authorisation is not scoped per program: any authenticated client may
reserve, release and read any program. A dev-only script mints tokens for local use.

**Rationale.** Standard for service-to-service calls and carries an identity for the
audit trail. Per-program scoping is a plausible next step and is kept a one-place
change.

## A-15 State is durable; the ledger carries running balances

- Status: accepted 2026-09-19
- Source: Q22, Q23

**Statement.** State survives restarts (a durable database, engine chosen in an ADR).
Storage has two state tables (programs, reservations), one append-only ledger of
capacity movements with `limit_after`, `reserved_after` and `available_after` on every
row, and one table of treasury messages with raw payload and processing outcome. The
latest ledger row of a program is its current state; `reserved` on the program and
`held` on the reservation are copies for convenient reads, not sources.

**Rationale.** Reconciliation and disputes are unexplainable without history;
idempotency needs `releaseId` and `messageId` stored anyway, so the ledger costs no extra
table. Running balances make the current state an O(1) read. Data model sketch in the
"Model danych" artifact.

## A-16 Health is unauthenticated; Swagger UI and Redoc are served outside production

- Status: accepted 2026-09-19, amended 2026-09-19 (both documentation views, AC-00)
- Source: Q24 (Marcin: "I want Swagger, health without auth"), AC-00

**Statement.** Liveness and readiness endpoints need no token and expose no business
data. The OpenAPI document is generated once from the DTOs (`@nestjs/swagger` decorators)
and served in two views when the profile is not production: Swagger UI for trying
requests against the running service, Redoc for reading the contract. Both views and the
raw document are served without a token. One document, two renderers, no duplicated
descriptions. All other endpoints require a token. Recorded because the brief
says "all endpoints".

## A-17 Runnable locally means one command plus a demo page

- Status: accepted 2026-09-19, amended 2026-09-19 (the demo is its own container; the local
  stack is five containers, `studio` included)
- Source: Q25

**Statement.** `docker compose up` starts five containers from a clean checkout: `api`,
`web`, `db`, `kafka` and `studio` (ADR-0001). `studio` is a database browser on its own port,
started in the dev profile only and never deployed to production, so that a reviewer can read
and correct rows by hand without installing a client; which tool fills that slot is ADR-0002's
decision, not this assumption's. A second command mints a dev token. The demo is the
`web` container: a small React UI (Vite, TypeScript) in its own `web/` folder, built to
static files, a few tables and forms, showing a random reserve/release generator that calls the real `api` endpoints, the list of
requests with their status codes, the ledger appended live, and a treasury panel that
publishes real messages to Kafka through dev-only `api` endpoints (limit change, snapshot,
duplicate, stale message). `web` contains no business logic, lives in `web/` isolated from `api/`, and is not deployed
in production; the dev-only `api` endpoints exist only outside the production profile. Last
slice; budget half a day. Amended 2026-09-19: the page moved from a module inside the
service to its own container, so the API stays only an API. Amended again 2026-09-19: the
count is five, not four. `studio` joined the local stack when ADR-0002 was accepted and this
statement had not caught up, which `/review` found while S-01 was being built.

**Rationale.** A reviewer should see the system working within a minute, through the
real code paths, without writing curl commands.

## A-18 Observability: structured logs and health only

- Status: accepted 2026-09-19
- Source: Q26

**Statement.** JSON logs with a correlation id per HTTP request and per Kafka message,
liveness and readiness endpoints. Metrics and tracing are named as follow-ups and not
built.

## A-19 The read model is availability per program and one reservation by id

- Status: accepted 2026-09-19
- Source: Q27

**Statement.** Clients read the availability of a program (limit, reserved, available,
currency, `asOf` of the last reconciliation, overcommitted flag) and a single
reservation by id (all three amounts, rate, status, movements). Listing reservations of a
program is not an acceptance criterion.

## Changes

| Date | Id | Change | Where |
|---|---|---|---|
| 2026-09-18 | A-01 to A-04 | written during the spec discussion | PR #5 |
| 2026-09-19 | A-05 to A-19 | written from the answered questions; A-05 awaits wording confirmation | PR #5 |
| 2026-09-19 | A-16 | amended: Swagger UI and Redoc, both views over one OpenAPI document | PR #10 |
| 2026-09-19 | A-17 | amended: demo moves from a module in the service to the `web` container; four compose services (ADR-0001) | docs/adr-renumber-and-deployment |
| 2026-09-19 | A-17 | amended: five compose services, `studio` is the fifth (ADR-0002); stale count found by `/review` in S-01 | slice/S-01-walking-skeleton |
| 2026-09-21 | A-12 | amended: a currency change applies only to a program with no active reservation, otherwise `CURRENCY_MISMATCH` (ADR-0007) | docs/a-12-currency-change |
| 2026-09-21 | A-06 | amended: the treasury may set the limit to zero, a frozen program; found by review round 3 of S-02 | slice/S-02-programs-from-the-treasury |
| 2026-09-21 | A-13 | amended: clause (5), the checks run in order, duplicate before rejected and stale before rejected; found by review rounds 3 and 4 of S-02 | slice/S-02-programs-from-the-treasury |
| 2026-09-22 | A-10 | amended: currency codes are normalised to upper case at both boundaries, not refused for their case; the two edges disagreed, found by review round 2 of S-03 | slice/S-03-reservations-and-capacity-invariant |
| 2026-09-22 | A-10 | amended: conversion respects each currency's ISO 4217 minor unit exponent (JPY 0, KWD 3, default 2) and `rate` reads back canonical; gaps found while revising the S-04 plan | docs/a-10-minor-units-and-rate-format |
| 2026-09-24 | A-08 | amended: `held` is derived from what the invoice has left rather than decremented per release, and over-release is judged in invoice currency (ADR-0009); found by review round 3 of S-05 | docs/release-assumptions |
| 2026-09-24 | A-09 | amended: a release is refused once nothing is left to release, which is not the same as `held` reaching zero (AC-15, amended); found by review round 3 of S-05 | docs/release-assumptions |
| 2026-09-25 | A-12 | amended: a 30 s keep window before `asOf` for omitted reservations, the shape and `createdAt` of a snapshot-created reservation, a listed reservation compared as of `asOf`, and a reopen of one closed at or before `asOf` (ADR-0010, ADR-0011, ADR-0012) | docs/s-06-reconciliation-wording |
| 2026-09-25 | A-12 | amended: a snapshot in another currency with a stale limit is refused; a listed reservation in another currency is skipped and logged, and no longer stops a re-denomination; found by review round 1 of S-06 | slice/S-06-reconciliation-snapshots |
| 2026-09-25 | A-13 | amended: clause (6), three attempts then unprocessable, each failure kept (ADR-0013); clause (7), on an equal `asOf` the later snapshot delivered is applied; found by review round 1 of S-06 | slice/S-06-reconciliation-snapshots |
