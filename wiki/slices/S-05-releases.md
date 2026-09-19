# S-05 Releases

- Outcome: a client releases a reservation in full or in instalments, in invoice currency, idempotently by `releaseId`, and reads a reservation with its movements.
- Status: planned
- AC: AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-34
- INV: INV-02
- Risk: high. Money: proportional conversion of instalments with the stored rate and exact closing of the last one; idempotency with the original outcome in the body. Implemented on Fable per `CLAUDE.md §8`.
- Depends on: S-04. ADR that must be accepted first: [[../decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]].

## Scope

Domain:
- `Reservation.release(amount?: Money in invoice currency, releaseId, reason, clientId)` per ADR-0009: absent amount means "everything left"; `amount > remaining invoice amount` is `ReleaseExceedsHeld`; `held = 0` before the call is `ReservationAlreadyReleased`; a known `releaseId` is `ReleaseAlreadyProcessed(original outcome)`. Returns the new `held` and a `release` movement (`deltaHeld` negative, `releaseId`, `reason`, `clientId`).
- `ReleaseReason` enum: `repaid` (default), `cancelled`.
- `Program.release(deltaHeld)` lowers `reserved`; `available` follows the formula; an overcommitted program may become committed again.
- Domain errors: `ReservationNotFound`, `ReservationAlreadyReleased`, `ReleaseExceedsHeld`, `ReleaseAlreadyProcessed`.

Application:
- `ReleaseCapacity` use case: one transaction, lock the program row, load the reservation, apply, append movement, update `programs.reserved` and `reservations.held`.
- `GetReservation` query: reservation plus its movements ordered by time.

Infrastructure:
- `POST /programs/:programId/reservations/:invoiceId/releases` body `{releaseId, amount?, reason?}` → `200` with the reservation as in S-03 plus `releasedInvoiceAmount`. Errors: `400 VALIDATION_FAILED`, `404 RESERVATION_NOT_FOUND` (unknown program or unknown invoice on that program), `409 RESERVATION_ALREADY_RELEASED`, `409 RELEASE_ALREADY_PROCESSED` (`details.appliedAt`, `details.heldAfter`), `422 RELEASE_EXCEEDS_HELD` (`details.held`, `details.remainingInvoiceAmount`).
- `GET /programs/:programId/reservations/:invoiceId` → `200 {programId, invoiceId, invoiceAmount, invoiceCurrency, reservedAmount, held, rate, status, source, createdAt, movements: [{kind, amount, reason, releaseId, messageId, clientId, occurredAt}]}`; `404 RESERVATION_NOT_FOUND`.
- Migration: `capacity_movements.release_id` and `reason` exist since S-02; add `UNIQUE (reservation_id, release_id)` (scope per ADR-0009) and `reservations.released_invoice_amount BIGINT`.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-10] should apply a partial release in invoice currency, reduce held by the converted amount and grow availability')` | e2e | INV-B 2 750 000 EUR at 1.10; release 1 000 000 EUR `R-1`; `held` 1 925 000 USD, status active, availability up by 1 100 000 |
| `it('[AC-11] should close the reservation when the release carries no amount')` | e2e | continues from AC-10 state; `held` 0, status closed, availability up by 1 925 000 |
| `it('[AC-12] should close exactly at zero when the final instalment does not divide evenly by the rate')` | e2e | invoice 1 000 000 EUR at `"1.13"` (1 130 000 USD); release 333 333 EUR twice, then the remaining 333 334 EUR; `held` is exactly 0 and availability is back to the start |
| `it('[AC-13] should reject a release beyond held with RELEASE_EXCEEDS_HELD and change nothing')` | e2e | INV-A holds 500 000 USD; release 500 000.01; `422`, `held` unchanged |
| `it('[AC-14] should answer 404 RESERVATION_NOT_FOUND for a release on an unknown invoice')` | e2e | known program, unknown invoice |
| `it('[AC-15] should answer 409 RESERVATION_ALREADY_RELEASED for a new releaseId on a closed reservation')` | e2e | |
| `it('[AC-16] should answer 409 RELEASE_ALREADY_PROCESSED with the original outcome for a repeated releaseId')` | e2e | `R-1` again with the same and with another amount; `details.appliedAt` and `details.heldAfter` equal the first response; ledger unchanged |
| `it('[AC-17] should record the release reason on the movement, defaulting to repaid, without changing the effect')` | e2e | one release with `cancelled`, one without reason; movements show `cancelled` and `repaid`; availability moves the same way |
| `it('[AC-18] should reflect a reservation and a release in availability immediately after the response')` | e2e | read availability right after the `201` and right after the `200`; all six fields present (`limit`, `reserved`, `available`, `currency`, `asOf`, `overcommitted`) and already updated |
| `it('[AC-19] should return the reservation with its amounts, rate, status, source and movements')` | e2e | after a reserve and a partial release: two movements with kind, amount, reason, `releaseId`, `clientId`, time; `messageId` null on both |
| `it('[AC-34] should record the authenticated client id on reserve and release movements')` | e2e | two tokens with different `sub`; reserve with one, release with the other; movements carry the matching ids |
| `it('[INV-02] should keep held between 0 and reservedAmount over random release sequences')` | unit | property test over `Reservation` with random instalments including over-release attempts, at rates with awkward decimals; final full release always closes at exactly 0 |

## ADR candidates

- [[../decisions/ADR-0009-release-conversion-exact-closing-and-release-id-scope]]: how `held` follows the remaining invoice amount so the last instalment closes exactly; whether `releaseId` is unique per reservation or per program.

## Definition of done

Beyond `CLAUDE.md §9`:

- README shows a partial release, a full release and a repeated `releaseId` with their responses.
- Glossary words `held`, `release`, `release id`, `release reason` appear in code exactly as written there.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
