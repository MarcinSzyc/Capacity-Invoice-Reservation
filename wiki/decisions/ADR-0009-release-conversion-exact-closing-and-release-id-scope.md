# ADR-0009: Release conversion, exact closing and the scope of releaseId

- Status: proposed
- Date: 2026-09-19
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

(empty until Marcin decides)

## Consequences

The `reservations` table gains `released_invoice_amount`; `RELEASE_EXCEEDS_HELD` reports
`details.held` and `details.remainingInvoiceAmount`. A movement's `amount` on the API is the
program-currency delta; the invoice-currency amount of the release is recoverable from the
request but not stored per movement (add a column if the demo or a client needs it).
