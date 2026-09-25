# ADR-0012: Snapshot corrections on a reservation whose held is derived

- Status: accepted
- Date: proposed 2026-09-25, accepted 2026-09-25
- Slice: S-06
- Related: A-08, A-12, AC-15, AC-27, AC-29, INV-02, INV-06, INV-07, ADR-0009, ADR-0011

## Context

The S-06 plan was written on 2026-09-19, before releases existed. S-05 then shipped ADR-0009:
`held` is not decremented per release, it is derived from what the invoice has left,
`held = convert(invoiceAmount - releasedInvoiceAmount, rate)`, so the last instalment closes at
exactly zero. A snapshot works in the other direction: it states `held` in program currency and
says nothing about the invoice. Three questions follow that the first plan did not see.

**Question 1: how does a correction survive the next release?** AC-29 corrects `INV-B` from
1 925 000 to 1 900 000. If only `held` is written, the next release recomputes `held` from the
remaining invoice and silently puts the 25 000 back, inside a row of kind `release`. A-12 wants
every difference to be an `adjustment` pointing at its message, so that cannot be the answer.

**Question 2: what is a listed reservation compared against?** A snapshot describes `asOf`. A
client may have released part of the invoice after `asOf` and been told `200`. Comparing the
listed `heldAmount` with the current `held` would treat that release as a disagreement and
undo it. INV-06 names the same harm for reservations created after `asOf` ("reconciliation
erasing a success already returned to a client"); a release after `asOf` is the same kind of
success, and A-12 already says a snapshot "says nothing about what happened after".

**Question 3: what happens to a listed reservation that is closed locally?** A-12 speaks of
"active" reservations, and a closed one is not in the local set, but (program, invoice) is
unique (A-07), so it cannot be added again either. The case arises when a snapshot dropped the
invoice and a later one lists it again, or when the client repaid it before `asOf` and the
treasury has not seen the repayment. INV-07 decides part of this: delivered in reverse, the
drop-then-relist sequence ends active (the relisting snapshot applies, the older two are stale),
so in-order delivery must end active too, or INV-07 fails.

## Options

### Question 1

#### Option 1A: store a signed correction next to the derivation
The reservation gains `heldCorrection`, signed minor units of the program currency, 0 until a
snapshot says otherwise. `held` is 0 when the reservation is closed, and otherwise
`max(0, convert(remaining, rate) + heldCorrection)`. A snapshot sets the correction so that
`held` equals its target; it sets, never adds, so the same snapshot twice changes nothing.
Releases keep ADR-0009 exactly: over-release is judged in invoice currency, the last instalment
closes at zero. Example, AC-29: invoice 1 925 000 USD at rate 1, correction set to minus 25 000,
`held` 1 900 000; a release of 900 000 leaves `held` 1 025 000 minus 25 000, which is 1 000 000.
Cost: one column, one field, and a `held` formula with one more term.

#### Option 1B: re-express the correction in invoice currency
Move `releasedInvoiceAmount` by the correction converted back at the stored rate. No new column,
but the reverse conversion rounds, so `held` after the next release can differ from the
snapshot by up to half a rate's worth of minor units; a correction upwards is capped at the
invoice amount; and `releasedInvoiceAmount` would stop meaning what the client released.

#### Option 1C: write `held` only
What the first plan assumed. Rejected: the next release undoes the correction and records it as
a release.

### Question 2

#### Option 2A: compare as of `asOf`
The target for a listed reservation is the listed `heldAmount` plus the signed `deltaHeld` of that
reservation's client movements (`reserve`, `release`) after `asOf`, floored at zero. Example: listed
at 1 900 000 as of 18:00, the client released 500 000 USD at 18:05 and `held` is 1 425 000 now; the
target is 1 400 000 and the adjustment is minus 25 000, the same difference the treasury saw. An
omitted reservation is still dropped entirely: the treasury says it was gone at `asOf`, and a
later partial release does not bring it back.

#### Option 2B: compare with the current `held`
Simpler, one read fewer. The example above would adjust by minus 25 000 plus 500 000 upwards,
restoring capacity the client already released. The next snapshot would fix it, but in between
the program shows less available than it has.

### Question 3

#### Option 3A: reopen, unless the client closed it after `asOf`
A listed reservation closed at or before `asOf` is reopened: the remaining invoice amount is
restored to the listed `held` converted back at the stored rate (round half up, at least one minor
unit, at most `invoiceAmount`), and the correction from question 1 makes `held` exactly the listed
amount; one `adjustment` records it. A reservation whose closing release came after `asOf` is left
closed, since that repayment is newer than the snapshot (this is question 2 applied to a full
release). INV-07 holds for the drop-then-relist sequence.

#### Option 3B: closed is terminal
The listing is logged as an anomaly and ignored. Simpler, and it never takes capacity for an
invoice our client says is repaid. But INV-07 fails for drop-then-relist, so INV-07 would need a
carve-out through `/spec`, and the treasury's statement would be lost until someone acts on the log.

## Recommendation

1A, 2A, 3A. 1A is the only option that keeps both ADR-0009's exact closing and the snapshot's
exact figure. 2A is A-12's own sentence, "silent about anything after", applied to releases the
way INV-06 applies it to creations. 3A is what INV-07 requires, and the exception for a closing
release after `asOf` keeps it from reopening an invoice the client repaid after the snapshot's
moment.

## Decision

Options 1A, 2A and 3A, as recommended. Decided by Marcin on 2026-09-25.

- **1A: a stored, signed correction.** The reservation gains `heldCorrection`, signed minor units
  of the program currency, 0 by default. `held` is 0 when the reservation is closed, and
  otherwise `max(0, convert(invoiceAmount - releasedInvoiceAmount, rate) + heldCorrection)`. A
  snapshot sets the correction so `held` equals its target; it never adds to it, so the same
  snapshot twice writes nothing the second time. Releases keep ADR-0009 unchanged. In AC-29 the
  correction becomes minus 25 000 and a release of 900 000 then leaves `held` 1 000 000.
  Option 1B was declined because the reverse conversion rounds and would change what
  `releasedInvoiceAmount` means. Option 1C was declined because the next release undoes it.
- **2A: a listed reservation is compared as of `asOf`.** The target is the listed `heldAmount`
  plus the signed `deltaHeld` of that reservation's `reserve` and `release` movements after
  `asOf`, floored at zero. Adjustment rows are not counted. An omitted reservation is still
  dropped entirely. Option 2B was declined because it undoes a release the client was told
  succeeded after the snapshot's moment.
- **3A: reopen, unless the client closed it after `asOf`.** A listed reservation closed at or
  before `asOf` is reopened: the remaining invoice amount is restored to the listed `held`
  converted back at the stored rate (round half up, at least one minor unit, at most
  `invoiceAmount`), the correction makes `held` exactly the listed amount, and one `adjustment`
  records it. A reservation whose closing release came after `asOf` stays closed. Option 3B was
  declined because INV-07 fails for an invoice dropped and then listed again.


## Consequences

With 1A: a migration adds `reservations.held_correction BIGINT NOT NULL DEFAULT 0`; the glossary
entry `Held` changes from "reserve minus the sum of releases" to "plus adjustments", and the new
field needs its own entry with the AC-29 example (through `/spec`). The reservation read does not
show the correction; the `adjustment` movements explain it.

With 2A: the ledger gains a read of a program's client movements after a moment, one query per
snapshot rather than one per reservation. A-12 should say that a listed reservation is compared as
of `asOf` (Changes row via `/spec`).

With 3A: A-12 should say that a snapshot may reopen a reservation closed before its moment
(Changes row via `/spec`). A treasury that lags a client's repayment will take the capacity back
until its next snapshot; that is the price of the treasury being authoritative for its moment.
