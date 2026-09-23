# ADR-0009: Release conversion, exact closing and the scope of releaseId

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-23
- Slice: S-05
- Related: A-08, A-09, A-10, AC-10, AC-11, AC-12, AC-13, AC-16, INV-02

## Context

Releases are expressed in invoice currency and converted with the reservation's stored rate
(A-08). Intermediate instalments round half up; the final instalment must bring `held` to
exactly zero (AC-12), which naive per-release rounding cannot promise (three thirds of
1 130 000 rounded separately do not sum to 1 130 000). Separately, `releaseId` identifies a
repayment (A-09) and its uniqueness scope decides what "the same id twice" means.

## Options

### How held follows releases

**Option 1: Convert each release independently and subtract.** `held -= round(amount * rate)`;
when the client releases without amount, set `held = 0`. AC-12 fails whenever the sum of
rounded instalments differs from `reservedAmount` by a minor unit, unless a special case
"if the released invoice total equals invoiceAmount then held = 0" is added.

**Option 2: Track the remaining invoice amount and derive held from it.** The reservation
stores `releasedInvoiceAmount` (invoice currency). After a release:
`remaining = invoiceAmount - releasedInvoiceAmount - amount`,
`heldAfter = round(remaining * rate)`, movement `deltaHeld = heldAfter - heldBefore`. When
`remaining = 0`, `heldAfter = 0` without any special case, rounding error never accumulates
(each `held` is one rounding of one product), and "release beyond held" becomes
`amount > invoiceAmount - releasedInvoiceAmount`. Absent amount means `amount = remaining`.

### Scope of releaseId

**Option A: unique per reservation** (`UNIQUE (reservation_id, release_id)`). AC-16's "R-1
again on INV-B" is a duplicate; `R-1` on another invoice is a new release. Matches a client
whose repayment ids are per invoice.

**Option B: unique per program.** A repayment id reused across invoices is a duplicate. Safer
against copy-paste errors, but a client with per-invoice numbering (`1`, `2`, `3`) would collide
across invoices.

## Recommendation

Option 2 and Option A. Option 2 makes AC-12 and INV-02 fall out of the formula; the response
gains `releasedInvoiceAmount` so a client can see the remainder. Option A is the least
surprising reading of A-09 ("the client's identifier of one repayment" of that invoice).

## Decision

Option 2 and Option A, as recommended. Decided by Marcin on 2026-09-23.

- **`held` is derived from what is left of the invoice, not decremented per release.** The
  reservation stores `releasedInvoiceAmount` in invoice currency. A release computes
  `remaining = invoiceAmount - releasedInvoiceAmount - amount`, then
  `heldAfter = round(remaining * rate)`, and the movement carries
  `deltaHeld = heldAfter - heldBefore`. Option 1, converting each release on its own and
  subtracting, was declined because AC-12 then holds only by special case: three instalments of
  333 333, 333 333 and 333 334 EUR at `1.13` round separately to amounts that need not sum to
  the 1 130 000 USD originally reserved, so the final release would have to be patched with
  "if the whole invoice is released then `held = 0`". Deriving `held` from the remainder makes
  AC-12 and INV-02 fall out of the formula instead: every `held` is one rounding of one product,
  so error never accumulates, and `remaining = 0` gives `heldAfter = 0` with nothing special
  about it.
- **A release with no amount means the whole remainder**, `amount = remaining`, which is the
  same path as any other release rather than a second one.
- **Over-release is judged in invoice currency**: `amount > invoiceAmount - releasedInvoiceAmount`
  is `RELEASE_EXCEEDS_HELD`. Judging it against `held` in program currency would let a release
  that is legal in invoice terms fail on a rounding boundary.
- **`releaseId` is unique per reservation**, `UNIQUE (reservation_id, release_id)`. A-09 calls it
  "the client's identifier of one repayment", and a repayment is of one invoice, so `R-1` on
  another invoice is a different release, not a duplicate. Option B, unique per program, was
  declined because a client numbering repayments per invoice (`1`, `2`, `3`) would collide
  across invoices for no fault of its own; the copy-paste protection it buys is not worth
  refusing a legitimate numbering scheme.

## Consequences

The `reservations` table gains `released_invoice_amount`, in invoice currency and in minor units
like every other amount (ADR-0006), backfilled to zero for the reservations S-03 and S-04
created. `RELEASE_EXCEEDS_HELD` reports `details.held` and `details.remainingInvoiceAmount`, so
a client that asked for too much can see both what is left to release and what that is worth
against the limit. The reservation read (AC-19) gains `releasedInvoiceAmount` for the same
reason.

A movement's `amount` on the API is the program-currency delta; the invoice-currency amount of
the release is recoverable from the request but is not stored per movement. Add a column if the
demo or a client needs it, rather than deriving it from the delta and the rate, which would
round a second time.

The rate is now load bearing twice: once when the reservation is opened and again on every
release. It is already immutable (A-02) and stored exactly (ADR-0006), so nothing new is needed,
but a wrong rate is now wrong for the life of the reservation rather than only at its start.
