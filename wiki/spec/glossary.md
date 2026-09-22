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
| `held` | program | how much of `reservedAmount` is still occupying the limit | decreases with each release |

Example. Invoice of 1 100 000 EUR in a USD program at rate 1.10:

| Step | invoiceAmount | reservedAmount | held |
|---|---|---|---|
| reserve | 1 100 000 EUR | 1 210 000 USD | 1 210 000 USD |
| release 600 000 EUR | 1 100 000 EUR | 1 210 000 USD | 550 000 USD |
| release the rest | 1 100 000 EUR | 1 210 000 USD | 0 USD |

**Held.** See the table: the part of a reservation still counted against the limit,
in program currency. Starts equal to `reservedAmount`, ends at zero. Can always be
recomputed from the ledger as reserve minus the sum of releases for that invoice.

**Active reservation.** `held > 0`. **Closed reservation.** `held = 0`.

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
reservation's own rate. A full repayment is a release of 100% of what is left. A release
larger than `held` is rejected.

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
or a corrected `held`. Always marked as coming from reconciliation so the audit trail
shows what the treasury changed.

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
created after it are kept even if the snapshot does not list them; local reservations
created before it and missing from the snapshot are released by adjustment.

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
such as `CURRENCY_MISMATCH`. Recorded with its reason when its message id can be read, set
aside as a dead letter, and consumption continues with the next message.

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

**Adapter.** A class in `infrastructure/` that implements a port with real technology:
a Prisma repository, a config-file rate table, a Kafka producer.

**Seam.** The place where an adapter can be swapped for another without touching the
domain: the port plus the one line in the Nest module that binds an implementation to
it. "Behind a seam" means "replaceable by changing that one binding". Example:
`RateProvider` is a port; `ConfigRateProvider` is the adapter used in this brief;
a treasury- or market-fed provider would be another adapter behind the same seam.

**Fake.** A hand-written, working implementation of a port used in tests, such as a
repository backed by an array or a rate provider with one fixed rate. Preferred over
mocks because it behaves like the real thing and does not encode call expectations.
