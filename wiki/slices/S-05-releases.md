# S-05 Releases

- Outcome: a client releases a reservation in full or in instalments, in invoice currency, idempotently by `releaseId`, and reads a reservation with its movements.
- Status: in progress
- AC: AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-34
- INV: INV-02
- Risk: high. Money again, and harder than S-04: a release converts with the stored rate, three instalments must close at exactly zero, and a repeated `releaseId` must answer the original outcome without touching state. Per `CLAUDE.md §8` this is Fable work.
- Depends on: S-04 (done 2026-09-23). ADR: [[../decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]], accepted 2026-09-23, Option 2 and Option A. No other ADR is needed before `/implement`.

## Revision of 2026-09-23

The slice was first written on 2026-09-19, before any code existed and before ADR-0009 was
decided. S-04 shipped today (tag `S-04`, merge 60d7f42) and the ADR was accepted the same day.
This revision reconciles the file with both, so `/implement` runs without a design
conversation. What changed against the first version:

- ADR-0009 is no longer a question. `held` is derived from what is left of the invoice, the
  reservation stores `releasedInvoiceAmount`, and `releaseId` is unique per reservation. The
  scope below spells out the formula rather than pointing at the ADR.
- The error envelope is the one S-02 to S-04 shipped: a domain error's `details` are spread at
  the **top level** of the error body next to `code` (`error-body.ts`, `renderDetails`), and
  `details` as a JSON field is a list of message strings, used only by validation failures. The
  first version wrote `details.appliedAt`, `details.heldAfter`, `details.held` and
  `details.remainingInvoiceAmount`; all four are top level fields (decision 2).
- S-04 shipped `Rate` and `Money.convert`, so a release converts with one call rather than
  needing anything new; and `reservations.rate` already exists. The read model gains `rate`
  next to `releasedInvoiceAmount` (AC-19 names `rate` explicitly).
- `capacity_movements` already carries `reservation_id`, `release_id` and `reason` from S-02 and
  S-03, so the migration adds only the unique constraint and one column (decision 4).
- `Ledger.recompute` needs no change: it chains on `deltaHeld` and only special cases
  `limit_set` for limit changes, so a `release` row with a negative delta already recomputes
  (checked against `domain/ledger.ts`).
- `ReservationRepository` has only `findByInvoice` and `add` today, since S-03 removed the
  listing method nothing called. S-05 adds `save` and the movement read the reservation page
  needs (decision 6).
- The property test for INV-02 reuses `domain/testing/seeded-random.ts`, which S-03 wrote and
  its slice file said S-05 would reuse.

## Carried from S-04

Two findings the S-04 ship carried rather than running another review cycle
([[../log/changelog]], S-04 row). They are the first commit of this slice, before any S-05 code:

| # | Finding | Where | Fix |
|---|---|---|---|
| C1 | `reservations.rate` has no `CHECK (rate > 0)`. Nothing in the service can write such a row, since the mapper is the only writer, but a zero or negative rate would make every later read of that row a `500` out of the mapper, which is the failure class review round 1 of S-04 found. The table already carries `reservations_held_within_reserved`, so a CHECK is the house pattern | `api/prisma/migrations/` | One migration adding `CHECK ("rate" > 0)`, in the same file as this slice's other schema changes. An integration case inserts a zero rate raw and expects the constraint to refuse it |
| C2 | The glossary illustrates `Adapter`, `Seam` and `Fake` with a `RateProvider` port, a config rate table and a `RATE_UNAVAILABLE` code, none of which exist: A-02 decided the rate comes from the client | `wiki/spec/glossary.md` | `/spec` work, not this slice's. Listed in the definition of done so `/review` does not find it again, and so it is fixed before S-05 ships rather than carried a second time |

## Scope

Module `src/modules/capacity/`, as in S-03 and S-04. Nothing in `web` changes in this slice.

Domain (`domain/`):
- `Reservation.release({amount, releaseId, reason, clientId, occurredAt})` per ADR-0009:
  `remaining = invoiceAmount - releasedInvoiceAmount`; an absent amount means `amount = remaining`;
  `amount > remaining` throws `ReleaseExceedsHeld`; `held.isZero()` before the call throws
  `ReservationAlreadyReleased`. Otherwise
  `heldAfter = (remaining - amount).convert(rate, programCurrency)` and the reservation moves to
  `releasedInvoiceAmount + amount` and `heldAfter`. Returns what the caller needs to build the
  movement: the new `held` and `deltaHeld = heldAfter - heldBefore`, a negative `Money`
  difference expressed as the pair rather than as a negative `Money`, because `Money` admits no
  negative amount (decision 3).
- `releasedInvoiceAmount: Money` joins `ReservationState`, `OpenReservation` (zero at creation)
  and `describe()`; `remainingInvoiceAmount` is a derived getter, never stored.
- `ReleaseReason = 'repaid' | 'cancelled'`, defaulting to `repaid`.
- `Program.release(deltaHeld)` lowers `reserved` and returns a `release` movement, mirroring
  `Program.reserve`. An overcommitted program may stop being overcommitted; `available` follows
  the existing formula with no special case.
- `errors.ts` gains `ReservationNotFoundError` (`not_found`), `ReservationAlreadyReleasedError`
  (`conflict`), `ReleaseAlreadyProcessedError` (`conflict`, carrying the original outcome) and
  `ReleaseExceedsHeldError` (`unprocessable`, carrying `held` and `remainingInvoiceAmount`). All
  four use kinds that already exist; no new `DomainErrorKind` is needed.

Application (`application/`):
- `ReleaseCapacity` use case, one transaction behind the same row lock as `ReserveCapacity`
  (ADR-0008): lock the program, load the reservation by `(programId, invoiceId)` or throw
  `ReservationNotFound`, check the `releaseId` against this reservation's movements and throw
  `ReleaseAlreadyProcessed` with the original outcome if it is known, then apply, append the
  movement, save the reservation and save the program. The duplicate check runs before the
  amount rules, as it does on reserve, so a repeated `releaseId` answers `409` whatever amount
  it carries (AC-16).
- `GetReservation` query: the reservation plus its movements in time order, for AC-19.

Infrastructure (`infrastructure/`):
- Migration `releases`: `ALTER TABLE reservations ADD COLUMN released_invoice_amount BIGINT NOT
  NULL DEFAULT 0` then `DROP DEFAULT` (the S-03 and S-04 rows have released nothing, so zero is
  the true backfill, and dropping the default keeps a forgetful mapper honest, as in S-04);
  `CREATE UNIQUE INDEX ON capacity_movements (reservation_id, release_id) WHERE release_id IS NOT
  NULL` (Option A; partial, because `limit_set` rows carry no release id); and C1's
  `CHECK ("rate" > 0)` on `reservations`.
- `POST /programs/:programId/reservations/:invoiceId/releases`, body `{releaseId, amount?,
  reason?}`: `releaseId` a string of 1 to 128 characters, `amount` an optional JSON integer of
  at least 1 and at most `Number.MAX_SAFE_INTEGER` (ADR-0006), `reason` an optional enum. `200`
  with the reservation in the S-04 shape plus `releasedInvoiceAmount`.
- `GET /programs/:programId/reservations/:invoiceId`: `200` with the same body plus `movements`,
  each `{kind, amount, reason, releaseId, messageId, clientId, occurredAt}`, where `amount` is
  the movement's `deltaHeld` in program currency as a JSON integer, signed.
- `ReservationRepository` gains `save(reservation)`; a new `MovementRepository` read, or an
  addition to `LedgerRepository`, returns a reservation's movements in time order (decision 6).

## Decisions fixed by this revision

Local choices with alternatives that were considered. None has the weight of an ADR; ADR-0009
already decided the two that did. Recorded so review can hold the code to them.

1. **The release amount carries no currency.** The body is `{releaseId, amount?, reason?}` and
   `amount` is read as invoice currency, because A-08 says a release is expressed in invoice
   currency and the reservation already knows which that is. Alternative: an explicit
   `amountCurrency` that must equal `invoiceCurrency`. Declined because it can only ever be one
   value, so it is a field whose sole purpose is to be wrong sometimes.
2. **Business fields on an error body are top level.** `ReleaseExceedsHeld` renders `held` and
   `remainingInvoiceAmount` next to `code`, and `ReleaseAlreadyProcessed` renders `appliedAt`
   and `heldAfter`, because that is what `renderDetails` does with a domain error's `details`
   and what AC-03 and AC-05 already produce. The first version of this file wrote them under a
   `details` object, which the envelope does not have.
3. **`deltaHeld` travels as a pair, not as a negative `Money`.** `Money.of` refuses a negative
   amount (S-02), and loosening that to let a release carry `-110 000 000` would weaken the type
   everywhere to serve one caller. `Reservation.release` returns `{heldAfter, deltaHeld}` where
   `deltaHeld` is a `bigint` difference, and `Program.release` takes the same. Alternative: a
   separate `SignedMoney`, declined as a second money type for one field.
4. **The unique index on `(reservation_id, release_id)` is partial.** `WHERE release_id IS NOT
   NULL`, because `limit_set` and `reserve` rows carry no release id and Postgres treats NULLs
   as distinct anyway; the partial index says so explicitly rather than relying on that.
5. **Idempotency is read from the ledger, not from a separate table.** The movements already
   carry `release_id`, so a repeated id is found by looking there, inside the same transaction
   and behind the same row lock. Alternative: a `releases` table like `treasury_messages`.
   Declined because a release, unlike a treasury message, always produces a movement, so the
   ledger is already the record; a second table would be a second source of truth for the same
   fact.
6. **The reservation page reads movements through a port the module owns**, added next to
   `ReservationRepository` rather than reaching into `LedgerRepository`'s write path. S-03's
   ledger helper reads rows directly in tests, which is a test concern; a production read model
   goes through a port like every other.
7. **`GET` of a reservation is not paginated.** A reservation's movements are one reserve plus a
   handful of releases, bounded by how many instalments an invoice has. Alternative: a page
   parameter now. Declined as a shape no requirement asks for; S-06's adjustments do not change
   the order of magnitude.
8. **A release of zero is refused by the DTO** (`@Min(1)`), like `invoiceAmount` on reserve. A
   zero release would append a movement with `deltaHeld` zero, which is a ledger row that says
   nothing happened.
9. **`RELEASE_ALREADY_PROCESSED` is `409`, not `200` with the original body.** A-09 and AC-16
   say the duplicate is answered with the original outcome in the body, and S-03 set the
   precedent for exactly this shape with `RESERVATION_ALREADY_EXISTS`. Answering `200` would
   make a duplicate indistinguishable from a fresh release.
10. **AC-18 gets its own test rather than being asserted inside AC-10 and AC-11.** It is about
    the read being immediate after both kinds of write, and it names all six availability
    fields; folding it into the release tests would leave the criterion without a test of its
    own.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-10] should apply a partial release in invoice currency, reduce held by the converted amount and grow availability')` | e2e | `INV-B` 275 000 000 EUR minor at `1.10`, so `held` 302 500 000 USD minor. Release 100 000 000 EUR minor with `releaseId` `R-1`: `200`, `held` 192 500 000, `releasedInvoiceAmount` 100 000 000, status `active`; availability up by 110 000 000 |
| `it('[AC-11] should close the reservation when the release carries no amount')` | e2e | continues from the AC-10 state: release with no amount and `releaseId` `R-2`; `held` 0, `releasedInvoiceAmount` 275 000 000, status `closed`, availability up by 192 500 000 |
| `it('[AC-12] should close exactly at zero when the final instalment does not divide evenly by the rate')` | e2e | invoice 100 000 000 EUR minor at `1.13`, so `held` 113 000 000 USD minor. Three releases of 33 333 333, 33 333 333 and 33 333 334 EUR minor: `held` is exactly 0 and availability is back to the limit. These numbers discriminate: rounding each release on its own (the declined Option 1) leaves 37 666 666 + 37 666 666 + 37 666 667, one minor unit short of 113 000 000, so `held` would end at 1 |
| `it('[AC-13] should reject a release beyond held with RELEASE_EXCEEDS_HELD and change nothing')` | e2e | `INV-A` 50 000 000 USD minor, same currency, rate 1. Release 50 000 001: `422`, code `RELEASE_EXCEEDS_HELD`, `held` 50 000 000 and `remainingInvoiceAmount` 50 000 000 at the top level of the body; `held` and availability unchanged, no movement appended |
| `it('[AC-14] should answer 404 RESERVATION_NOT_FOUND for a release on an unknown invoice')` | e2e | known program, unknown invoice id; and, as the same criterion, a known invoice id on a program that does not exist |
| `it('[AC-15] should answer 409 RESERVATION_ALREADY_RELEASED for a new releaseId on a closed reservation')` | e2e | fully release, then release again with a new id; `409`, ledger unchanged |
| `it('[AC-16] should answer 409 RELEASE_ALREADY_PROCESSED with the original outcome for a repeated releaseId')` | e2e | `R-1` again with the same amount, and again with a different amount: both `409` with `appliedAt` and `heldAfter` at the top level equal to the first release's outcome; `held`, availability and the movement count unchanged |
| `it('[AC-17] should record the release reason on the movement, defaulting to repaid, without changing the effect')` | e2e | one release with `reason` `cancelled`, one without; the reservation read shows `cancelled` and `repaid`; the two `deltaHeld` values and the availability change are the same for both |
| `it('[AC-18] should reflect a reservation and a release in availability immediately after the response')` | e2e | read availability right after the `201` of a reserve and right after the `200` of a release; both reads carry `limit`, `reserved`, `available`, `currency`, `asOf` and `overcommitted`, and both already include the operation just acknowledged |
| `it('[AC-19] should return the reservation with its amounts, rate, status, source and movements')` | e2e | after a reserve and a partial release: the body carries `invoiceAmount`, `invoiceCurrency`, `reservedAmount`, `held`, `rate`, `releasedInvoiceAmount`, `status`, `source`, `createdAt` and two movements in time order, `reserve` then `release`, with `kind`, signed `amount`, `reason`, `releaseId`, `clientId` and `occurredAt`; `messageId` null on both, `releaseId` and `reason` null on the reserve row |
| `it('[AC-34] should record the authenticated client id on reserve and release movements')` | e2e | two tokens with different `sub`: reserve with one, release with the other; the reservation read shows each movement carrying the id of the client that caused it |
| `it('[INV-02] should keep held between 0 and reservedAmount over random release sequences')` | unit | 1 000 seeded sequences over `Reservation` using `domain/testing/seeded-random.ts`: random instalments at rates with awkward decimals (`1.13`, `0.0067`, `3.2560`), including over-release attempts that are caught and counted; after every step `0 <= held <= reservedAmount`, and a final release of the whole remainder always closes at exactly 0. The seed is printed on failure |

Supporting tests expected beyond the plan (untagged, listed in `wiki/plan/plan.md` by `/ship`):
`Reservation.release` for the partial, full, absent-amount, over-release and already-closed
cases, and that `releasedInvoiceAmount` and `remainingInvoiceAmount` move together;
`Program.release` lowering `reserved` and leaving an overcommitted program correctly;
`ReleaseCapacity` against the fakes for each error and for the duplicate running before the
amount rules; the four new domain errors rendering at the right status with their fields at the
top level; the Prisma adapter saving and reading `released_invoice_amount`, the partial unique
index refusing a repeated `(reservation_id, release_id)` and the C1 CHECK refusing a zero rate;
and the movement read returning rows in time order.

## ADR candidates

- [[../decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]]: accepted
  2026-09-23, Option 2 and Option A. Nothing new: every decision this revision adds is local
  (see above).

## Definition of done

Beyond `CLAUDE.md §9`:

- C1 and C2 from S-04 are closed: the `CHECK ("rate" > 0)` is in the migration with a test, and
  the glossary's `Adapter`, `Seam` and `Fake` entries no longer illustrate a `RateProvider` that
  A-02 decided against. C2 is `/spec` work and must be requested before `/review`, the way S-03
  requested the `source` entry and S-04 the minor unit entry.
- README shows a partial release, a full release and a repeated `releaseId` with their
  responses, and the reservation read.
- The glossary words `held`, `release`, `release id`, `release reason` and
  `released invoice amount` appear in code exactly as the glossary writes them;
  `releasedInvoiceAmount` is a new domain word and needs its entry from `/spec` before
  `/review`.
- The `afterEach` ledger helper stays green across every release scenario, which is INV-03
  continuing to hold while `held` moves.

## Hand-off notes for later slices

- S-06: reconciliation adjusts `held` on reservations that already exist, so it writes through
  the same `Reservation` methods rather than its own path; `adjustment` is the fourth movement
  kind and the only one carrying a `messageId` on a reservation row. ADR-0011 still has to say
  what `invoiceAmount`, `rate` and `releasedInvoiceAmount` are for a reservation a snapshot
  creates, and this slice's `releasedInvoiceAmount` makes that question sharper, not looser.
- S-07: the demo page shows a reservation with its movements, which is exactly AC-19's body, so
  the page needs no computation of its own.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-23 | plan | revised against the shipped S-04 code and ADR-0009 as accepted; ten local decisions, no new ADR |
| 2026-09-23 | implement | started on Opus; `risk: high` would put this on Fable per `CLAUDE.md §8`, the Fable credits are exhausted and Marcin decided to run it here |
| 2026-09-24 | verify | PASS, gate green on 1aeeda8, 12/12 AC and INV covered at the planned level, AC-12 confirmed live on a cold started stack (75 333 334, 37 666 667, exactly 0 at `1.13`); 1 finding owed to `/ship` (README documents no release route) |
| 2026-09-24 | review | FAIL, 15 findings (0 blockers / 7 majors / 8 minors): a null `amount` answers 500, AC-14 answers PROGRAM_NOT_FOUND against its own Then clause, `held` can round to zero while the invoice still owes, AC-16 and the partial unique index have no test that can fail, and the glossary owes `releasedInvoiceAmount` and C2. Ran on Opus, not Fable: the model independence `CLAUDE.md §8` asks for did not hold |
