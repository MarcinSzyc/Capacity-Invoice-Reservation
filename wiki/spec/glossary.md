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
no-op for Kafka.

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
