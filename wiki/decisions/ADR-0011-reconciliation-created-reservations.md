# ADR-0011: Reservations created by reconciliation

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-25
- Slice: S-06
- Related: A-02, A-08, A-12, AC-19, AC-26, INV-08, ADR-0010, ADR-0012

## Context

A snapshot lists `{invoiceId, heldAmount}` in program currency, nothing else (A-11). When it
names an invoice we do not know, AC-26 creates a reservation with `source: reconciliation`.
That reservation must still carry `invoiceAmount`, `invoiceCurrency` and `rate` (AC-19), and a
client may later release it in "invoice currency" (A-08), which we never learned.

## Options

### Option 1: Program currency, rate 1
`invoiceAmount = heldAmount`, `invoiceCurrency = program.currency`, `reservedAmount = held =
heldAmount`, `rate = 1`. A later client release is expressed in program currency and works
with the normal rules. Honest about what we know: the treasury told us a held amount in
program currency. Cons: `invoiceAmount` is not the real invoice amount if the invoice was
partly repaid before we heard of it; the response says so through `source`.

### Option 2: Nullable invoice fields
`invoiceAmount`, `invoiceCurrency` and `rate` null for `reconciliation` reservations; releases
against them must be in program currency (validation error otherwise). Cons: three nullable
fields, a branch in every consumer of the reservation, a special release rule.

### Option 3: Refuse to create, dead-letter the snapshot
Cons: violates AC-26 and A-12; the treasury's knowledge would be lost.

## Recommendation

Option 1. `invoiceAmount` equals the `heldAmount` at creation, and the reservation read shows
`source: reconciliation` so a reader knows the amount is the treasury's held, not the
supplier's invoice. A later snapshot that reports a different `held` adjusts as for any other
reservation.

## Decision

Option 1, as recommended, with both addenda. Decided by Marcin on 2026-09-25.

A snapshot that lists an invoice we do not know creates a reservation with:

- `invoiceAmount` equal to the listed `heldAmount`, `invoiceCurrency` the program currency,
  `rate` 1, so `reservedAmount` and `held` equal `heldAmount` too;
- `source: reconciliation`, `clientId` null, and one `adjustment` movement of `+heldAmount`
  attributed to the snapshot's `messageId` (INV-09);
- `createdAt` equal to the snapshot's `asOf`, not the moment we processed it, so a later snapshot
  judges it on the treasury's clock alone (ADR-0010).

A client may release it like any other reservation, in what is now its invoice currency, the
program's. When a later snapshot omits it, it is dropped with `releasedInvoiceAmount` equal to
`invoiceAmount`, so `held` 0 and status closed coincide (AC-27). A listed `heldAmount` of 0 for
an unknown invoice creates nothing, since the reservation would be closed at birth.

Option 2, nullable invoice fields, was declined for putting a branch in every reader of a
reservation and a special release rule. Option 3, refusing to create, was declined because it
contradicts AC-26 and throws away what the treasury knows.


## Consequences

No nullable amount anywhere (INV-08 stays simple). The glossary entry `Adjustment` should say
that a reconciliation-created reservation's `invoiceAmount` is the held amount reported by the
treasury (glossary update through `/spec` on acceptance).

Added 2026-09-25, from S-05: an adjustment that drops a reservation has to set
`releasedInvoiceAmount` to the whole invoice amount, not only take `held` to zero. S-05 amended
AC-15 so that a reservation is closed when the invoice is fully released rather than when `held`
reaches zero, which split two things AC-27 states as one. Marcin decided the snapshot closes the
invoice too, so this ADR's shape for a snapshot-created reservation has to leave the same two
fields consistent: whatever `invoiceAmount` it chooses, an omitted reservation ends with
`releasedInvoiceAmount` equal to it.

Added 2026-09-25, from the S-06 plan revision: which `createdAt` such a reservation carries. It
must be the snapshot's `asOf`, not the moment we processed the message. The treasury knew the
invoice at `asOf`; if `createdAt` were our processing time, a later snapshot that omits the
invoice would find a `createdAt` after its own `asOf` whenever messages queue for a while, and
keep a reservation the treasury has dropped (ADR-0010, INV-06). `clientId` is null, since no
client made it, and the `adjustment` movement is attributed to the message (INV-09). Under
Option 1 a later correction goes through ADR-0012 like any other reservation's: with rate 1 and
the program's currency, the reverse conversion ADR-0012 Option 3A needs for a reopen is exact.
