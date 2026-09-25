# ADR-0010: Deciding whether a local reservation is older than a snapshot

- Status: proposed
- Date: 2026-09-19
- Slice: S-06
- Related: A-12, A-13, AC-27, AC-28, INV-06, INV-07, ADR-0011, ADR-0012

## Context

A snapshot describes a program at `asOf` (treasury clock). A local reservation has `createdAt`
(our clock). A-12: reservations created before `asOf` and missing from the snapshot are
released by adjustment; those created after are kept. Two clocks are compared, so a
reservation made a second before `asOf` on our clock may have been a second after on the
treasury's, and releasing it would undo a success already returned to a client (INV-06).
Keeping a reservation is safer than releasing it: a wrongly kept one is corrected by the next
snapshot, a wrongly released one frees capacity that another invoice may take.

## Options

### Option 1: Strict comparison, `createdAt < asOf`
Simplest, exactly A-12's words. Risk: clock skew of seconds releases fresh reservations.

### Option 2: Tolerance window in favour of keeping, `createdAt < asOf - tolerance`
A reservation created within `tolerance` (for example 30 s) before `asOf` is treated as
"after" for the purpose of releasing, but still corrected if listed. The window is
configuration with a documented default. Risk: a reservation the treasury genuinely closed
within the window stays until the next snapshot.

### Option 3: Tolerance plus "listed wins"
As Option 2, and a reservation listed in the snapshot is always compared regardless of
`createdAt`, since the treasury evidently knows it. The unlisted case keeps the window.

### Which clock stamps createdAt
The database clock (`now()` inside the transaction) rather than the application clock, so two
service instances agree; tests set `createdAt` explicitly through the repository to build
INV-06's interleavings.

## Recommendation

Option 3 with a 30 s default tolerance and the database clock. INV-06 tests both the strict
edge and the window; AC-28's 30 s example sits exactly on the window boundary and should use
a larger gap (60 s) so the test does not depend on the default.

Revised 2026-09-25, while revising the S-06 plan against the shipped S-05 code. The
recommendation changes in three places.

- **Option 2, not Option 3.** "Listed wins" compares a listed reservation regardless of
  `createdAt`, so a reservation created at 18:00:30 and listed by a snapshot of 18:00 would be
  corrected. INV-06 says a reservation created at `t` is never altered by a snapshot with
  `asOf < t`, listed or not. Option 2 keeps INV-06 as written: the window only widens keeping
  before `asOf`, and a listed reservation inside the window is still corrected, because it was
  created before `asOf` and the treasury knows it.
- **The `Clock` port, not the database clock.** S-03 shipped `createdAt` stamped by a `Clock`
  port whose comment already names INV-06, and the e2e app can override it, so AC-27, AC-28 and
  INV-06 can be written at 09:00, 18:00:30 and 18:00 through the API rather than by writing rows
  behind it. The skew between two service instances is milliseconds with NTP, far inside a 30 s
  window, so the window covers it too. The database clock stays a valid alternative; it would
  move stamping into the repository and the tests into it.
- **AC-28 does not touch the window.** The first text said its example sits on the boundary. It
  does not: the window is before `asOf`, and AC-28's reservation is 30 s after it, so it is kept
  whatever the window is. The test uses the criterion's own times.

A reservation created by a snapshot has `createdAt` equal to that snapshot's `asOf` (ADR-0011,
addendum of 2026-09-25), so a later snapshot judges it on the treasury's clock alone.

## Decision

(empty until Marcin decides)

## Consequences

Configuration gains `RECONCILIATION_KEEP_WINDOW_SECONDS`. A-12 should mention the window when
this ADR is accepted (Changes row via `/spec`). Operators see "kept within window" as a
distinct log event so skew becomes visible.
