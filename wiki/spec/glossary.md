# Glossary

Ubiquitous language for this project. Code, tests, API fields, Kafka messages, ADRs and
the wiki use exactly these words. A term used in code that is missing here is a defect.
Every entry has a plain explanation a newcomer can follow and, where it helps, a number
example. Source: [[brief]].

## The world around us

**Program.** A pot of money a financier (the treasury) sets aside to pay suppliers'
invoices early. Has one currency and one credit limit. Everything we count, we count
per program.

**Treasury system.** The external system that owns programs. It sets limits, pays
suppliers, receives repayments, and tells us about it over Kafka. It is the source of
truth; we are the fast mirror.

**Client.** The system that calls our HTTP API: it approves invoices for early payment
and reports repayments. Usually a platform between suppliers and the treasury. The only
actor who talks to us over HTTP.

**Invoice.** A bill a supplier issued to a buyer, with its own amount and currency. We
never see the document; we only know its id, amount and currency as the client tells us.

**Supplier, buyer.** The people behind the invoice. They never talk to us. Money flows
between them and the treasury, outside our system.

**Repayment.** The buyer pays the invoice to the treasury. The client learns about it
and reports it to us as a release.

## Capacity

**Credit limit.** The maximum amount, in program currency, that may be reserved at once
across all invoices of a program. Set by the treasury. Not a budget that gets used up: a
ceiling on how much can be outstanding at the same time, like a credit card limit.

**Reserved (program level).** The sum of `held` of all active reservations of a program.
How much of the limit is occupied right now.

**Available capacity.** `limit − reserved`, floored at zero. The answer to "how much
more can be financed in this program right now". Derived from three kinds of ledger
events only: limit changes, reservations and releases. Nothing external.

**Overcommitted.** `reserved > limit`. Can only happen when the treasury lowers the
limit below current usage. Available reads zero, new reservations are rejected, existing
ones stay valid.

**Capacity.** The limit seen as a pool: reservations draw from it, releases return to it.

## Reservation

**Reservation.** The claim one invoice holds on a program's capacity, from the moment
the client approves it for early payment until it is fully repaid. Exactly one per
(program, invoice id). Carries three amounts:

| Field | Currency | Meaning | Changes? |
|---|---|---|---|
| `invoiceAmount` | invoice | the invoice amount as the client sent it | never |
| `reservedAmount` | program | what the reservation took from the limit at creation, after conversion | never |
| `held` | program | how much of the reservation is still occupying the limit | decreases with each release; a reconciliation adjustment may move it either way |

Example. Invoice of 1 100 000 EUR in a USD program at rate 1.10:

| Step | invoiceAmount | reservedAmount | held |
|---|---|---|---|
| reserve | 1 100 000 EUR | 1 210 000 USD | 1 210 000 USD |
| release 600 000 EUR | 1 100 000 EUR | 1 210 000 USD | 550 000 USD |
| release the rest | 1 100 000 EUR | 1 210 000 USD | 0 USD |

**Held.** See the table: the part of a reservation still counted against the limit,
in program currency. Starts equal to `reservedAmount`, ends at zero. A client's release only
lowers it; a snapshot may set it higher than `reservedAmount` (INV-02, amended 2026-09-25). It
is what is left of the invoice converted at the stored rate, plus the `heldCorrection` a snapshot
may have set (ADR-0009, ADR-0012). Can always be recomputed from the ledger as the reserve plus the signed amounts of
the releases and adjustments of that invoice.

**Active reservation, closed reservation.** A reservation is closed when the whole invoice
amount has been released, so nothing is left to release; until then it is active. Usually that
is the same moment `held` reaches zero, but not always: `held` is the remaining invoice amount
converted at the stored rate, so a remainder worth less than half a minor unit of the program
currency rounds to zero while the invoice still owes. Such a reservation is active with `held`
zero: it occupies none of the limit, and it can still be released to the end (AC-15, amended
2026-09-24). A snapshot can close a reservation (it omits it) and can reopen one it lists, when
the reservation was closed at or before the snapshot's `asOf` (A-12, ADR-0012).

**Reservation source (`source`).** Who brought a reservation into existence. Exactly two
values: `client`, when a client reserved the invoice over HTTP (the reserve movement then
carries that client's id), and `reconciliation`, when a treasury snapshot listed an invoice
we did not know and the service created the reservation as an adjustment (A-12, S-06). Fixed
at creation, never changes, shown on every reservation the API returns. It answers the
question "did we learn about this invoice from the client or from the treasury", which is
what a reader of the ledger needs when the two disagree.

**Reservation identity.** On the API a reservation is named by its invoice id within a
program, because the pair (program, invoice id) is unique (A-07): there is no separate
public reservation number. Storage may give a reservation an internal id so the ledger can
point at one row; that id never appears in a request, a response or a message.

**Release.** Giving part or all of a reservation's `held` back to capacity because the
invoice was repaid. Expressed by the client in invoice currency, converted with the
reservation's own rate. A full repayment is a release of 100% of what is left. A release larger
than what the invoice still has to give back is rejected, judged in invoice currency rather
than against `held`, so a release that is legal in invoice terms cannot fail on a rounding
boundary (ADR-0009).

**Release reason.** Why a release happened: `repaid` (the buyer paid, money came back)
or `cancelled` (the approval was withdrawn, money never went out). Recorded on the
movement, changes no rule. Default `repaid`.

**Release id.** The client's identifier of one repayment (for example a bank
transaction id). Sent with every release. The same id twice means the same repayment
sent twice, which is rejected as a duplicate and changes nothing; a new id on a closed
reservation is a real error.

**Currency code.** The three letter ISO 4217 code that names a currency, `USD` or `EUR`.
Every boundary uppercases what it is given before it validates it, so a client that sends
`usd` reserves against a `USD` program and reads `USD` back; only a code that is not
three letters, or not an ISO 4217 code at all, is refused (A-10). Inside the service a
code is always upper case, and two codes are the same currency when the strings are
equal.

**Minor unit, minor unit exponent.** The smallest unit a currency is counted in, and how
many decimal places that is. USD and EUR have two (a cent is 0.01), JPY has none (the yen
is the unit itself, so 1 000 JPY is 1 000 minor units), KWD has three (a fils is 0.001).
Every amount in this service is an integer count of minor units, so the exponent is what
says where the decimal point goes when a number is shown to a person, and converting
between two currencies has to account for both currencies' exponents (A-10).

**Released invoice amount (`releasedInvoiceAmount`).** How much of the invoice has been
released so far, in invoice currency and minor units. The number `held` is derived from: what is
left of the invoice, converted at the stored rate (ADR-0009). A reservation of 2 750 000.00 EUR
with 1 000 000.00 EUR released has `releasedInvoiceAmount` 100 000 000 and 175 000 000 left.

**Held correction (`heldCorrection`).** The difference a snapshot found between the `held` the
treasury reported and the `held` the invoice implies, kept on the reservation in program currency
so that later releases do not undo it. Signed, zero until a snapshot corrects the reservation,
set rather than added to by each snapshot. Example (AC-29): an invoice of 1 925 000 USD at rate 1
holds 1 925 000; a snapshot says 1 900 000, so the correction is minus 25 000 and `held` is
1 900 000. A release of 900 000 then leaves 1 025 000 of the invoice, minus 25 000, so `held` is
1 000 000. Once the whole invoice is released `held` is 0 whatever the correction (ADR-0012).

**Conversion rate.** The rate used once, at reservation time, to express the invoice
amount in program currency. Supplied by the client in the reservation request (the
platform knows the rate the treasury will pay out at), stored on the reservation and
never changed, so every later release converts the same way.

## Ledger

**Capacity movement.** One recorded change to a program's capacity. Exactly four kinds:
`limit_set`, `reserve`, `release`, `adjustment`. The list of movements is the ledger.
Every movement stores the balances it left behind (`limit_after`, `reserved_after`,
`available_after`), so the latest movement of a program is its current state and program
`reserved` and reservation `held` are copies of it.

**Ledger.** The append-only list of capacity movements of a program. Rows are never
updated or deleted. Explains every number the service shows.

**Slice.** One unit of delivery in the plan: a coherent set of acceptance criteria and
invariants implemented through every layer (domain, application, infrastructure, tests)
so that, once shipped, a client can do something new end to end. Ids `S-xx`. Not a
technical layer ("all repositories") and not a single endpoint: a thin vertical cut.

**Adjustment.** A movement created by reconciliation, not by a client: a reservation the
treasury knows and we did not, a release the treasury saw and the client never reported,
a corrected `held`, or a reopened reservation. Always attributed to the snapshot's message id
so the audit trail shows what the treasury changed. A reservation created this way has an
`invoiceAmount` equal to the `held` the treasury reported, in program currency at rate 1,
because the treasury never tells us the real invoice: a snapshot listing `INV-X` at 700 000 USD
creates a reservation of 700 000 USD with source `reconciliation` (ADR-0011).

## Treasury messages

**Capacity update.** A small Kafka message changing one fact about a program, usually
its limit. May create a program we have not seen yet.

**Announce.** What the treasury's first message about a program does: it brings the program
into existence for us, with the currency that message carries. Until then the program does not
exist here and any request on it is `PROGRAM_NOT_FOUND`. Nobody but the treasury announces a
program (A-05).

**Reconciliation message (snapshot).** A Kafka message with a program's full state as
of one moment: limit, currency and the list of active reservations with their `held`.
Authoritative for that moment, silent about anything after it.

**Snapshot moment (`asOf`).** The point in time a snapshot describes. Local reservations
created at or after it are kept, listed or not, and never changed by that snapshot; local
reservations created before it and missing from the snapshot are released by adjustment,
unless they fall inside the keep window. A listed reservation is compared with what it held at
this moment, so a client's release after it stands. A reservation the snapshot creates takes
this moment as its `createdAt` (A-12).

**Keep window.** How long before a snapshot's `asOf` a client reservation must have been
created for that snapshot to release it by omission, default 30 seconds (ADR-0010). A reservation
a snapshot created has none: its `createdAt` is already on the treasury's clock. It exists because our
clock and the treasury's are compared: with a snapshot of 18:00:00, a reservation created at
17:59:45 and not listed is kept, and one created at 17:59:00 is released. Keeping wrongly is fixed
by the next snapshot; releasing wrongly frees capacity another invoice may take.

**Dev producer.** Code that exists only in the dev profile and publishes treasury-shaped
messages on the local Kafka broker, so the real consumer has something to read when no
treasury is present. Used by the `web` treasury panel through a dev-only `api` endpoint and
by the integration and e2e tests. Not registered in production.

**Message id.** The treasury's identifier of one message. Processing the same id twice
changes nothing.

**Event time (`eventTime`, `limitEventTime`).** The moment, by the treasury's clock, at which
a capacity update became true. Carried on every capacity update, always with a zone. Not the
moment we received it: a message can arrive late or out of order. The program remembers the
event time of the last limit it applied as `limitEventTime`, and a capacity update with an
older event time is stale. Example: an update stamped 10:05 sets 9 000 000; one stamped 10:00
that arrives afterwards changes nothing.

**Message outcome.** What became of one treasury message, recorded against its message id once
it has been consumed. Exactly four: `applied` (it changed the program and left a movement in
the ledger), `duplicate` (its message id had been seen before, nothing changed; see Duplicate
under Behaviour words), `stale` (valid, but describing an older moment than the one we already
hold, nothing changed), `rejected` (it could not be applied, nothing changed). Only `applied`
changes state; the other three are the record of a message that was heard and deliberately
left alone.

**Stale.** A valid treasury message describing an older moment than the one the program
already reflects: a capacity update whose event time is before `limitEventTime`, or a snapshot
whose `asOf` is before the last one applied. Recorded, never applied. This is what keeps
out-of-order delivery from reverting state. Staleness is checked first: a stale message is
never applied, so nothing in its body is judged, and a stale update that also carries another
currency is recorded `stale`, not `rejected` (A-13).

**Rejected.** A treasury message that cannot be applied at all: not JSON, failing the contract
(a missing field, a limit that is not an integer, a type we do not know), or refused by a rule
such as `CURRENCY_MISMATCH`, or failing to apply three attempts in a row for any other reason
(ADR-0013). Recorded with its reason when its message id can be read, set aside as a dead
letter, and consumption continues with the next message.

**Failed attempt.** One try at applying a treasury message that threw. The consumer tries a
message up to three times in one delivery; each failed try is a row in
`treasury_message_failures` with the attempt number and the error, and after the third the
message is rejected (ADR-0013). Example: a snapshot fails twice on a dropped database connection
and applies on the third try, leaving two rows and an `applied` record. While the database or the
broker is down, nothing can be recorded, so the message is delivered again instead.

**Reconciliation note.** A log line for every place a snapshot was not followed to the letter, so
an operator can see it. The kinds: `kept_within_window` (an omitted reservation too close to
`asOf` to release, ADR-0010), `listed_after_as_of` (a listed reservation created after the
snapshot's moment, left alone by INV-06), `kept_closed_after_as_of` (listed, but the client closed
it after `asOf`, ADR-0012), `listed_with_nothing_held` (an unknown invoice listed at 0, so nothing
is created), `listed_in_other_currency` (a closed reservation from before a re-denomination,
never reopened), `limit_skipped` (the snapshot's limit is older than the last capacity update) and
`as_of_ahead_of_our_clock` (the snapshot's moment is further ahead of our clock than the keep
window).

**Dead letter.** A copy of a treasury message we could not apply, set aside on a separate topic
next to the original, with the reason and where it came from attached, so a human can look at
it later. Every rejected message becomes a dead letter; a duplicate or stale one does not,
because nothing is wrong with it, there is only nothing to do. Setting a message aside never
stops consumption.

**Duplicate count.** How many times a treasury message's id has been seen again after the
first time. Kept on the first record of that message; a redelivery raises the count instead of
adding a row. Example: `m-1` is applied, then arrives twice more: duplicate count 2, still one
`limit_set` row in the ledger.

**`CURRENCY_MISMATCH`.** The reason recorded against a treasury message that carries a
different currency than the program already has, at a moment when the program still has an
active reservation. The message is not applied and the program is left exactly as it was;
the message is set aside on a separate topic for a human to look at, and the consumer moves
on to the next one rather than stopping. The reason this is refused rather than converted:
`held` of every active reservation is an amount in the old currency, and this service never
invents a rate of its own, so there is no honest way to re-express it. On a program with no
active reservation there is nothing to re-express, so the same message is applied as a
re-denomination: limit and currency change together (A-12, ADR-0007).

## Behaviour words

**Real time.** After we acknowledge an operation, every later read shows its effect.
Two parallel reservations can never both succeed on the same free capacity.

**Idempotent.** Doing the same thing twice leaves the same state as doing it once. Our
API achieves it by rejecting duplicates (same invoice id, same release id, same message
id) without changing anything.

**Duplicate.** A request or message whose identifier we have already processed. Always
an error response for HTTP (409 with the original outcome in the body), always a silent
no-op for Kafka. For a treasury message the silence is still recorded: the outcome kept
against the message id is `duplicate` and the first record's duplicate count goes up, so
"how often did m-1 arrive" has an answer without a second row. A known id is a duplicate
first, whatever the body says: a repeat that is malformed or would be refused is counted, not
set aside as a dead letter, because it is the same message heard again and nothing new about
it needs a human. The rule and its history live in A-13.

## Technical words used in ADRs

**Port.** An interface defined in `domain/` through which the domain asks for something
it cannot do itself: load a program, find a conversion rate, publish a message. The
domain knows only the interface.

**Adapter.** A class in `infrastructure/` that implements a port with real technology: a Prisma
repository, a Kafka consumer, a clock reading the system time.

**Seam.** The place where an adapter can be swapped for another without touching the
domain: the port plus the one line in the Nest module that binds an implementation to
it. "Behind a seam" means "replaceable by changing that one binding". Example: `Clock` is a
port; the adapter reads the system time, and a test binds one that answers a fixed moment, with
nothing in the domain aware of the difference.

**Fake.** A hand-written, working implementation of a port used in tests, such as a reservation
repository backed by an array or a unit of work that runs the work and can roll it back in
memory. Preferred over mocks because it behaves like the real thing and does not encode call
expectations.
