# S-08 Hardening: the carried review findings

- Outcome: no treasury message can stall its partition by what it contains, the demo page shows only the program it is asked about, and the snapshot path is proved at the scale its bound promises; every finding carried out of the S-06 and S-07 reviews is closed.
- Status: in progress
- AC: none new. Strengthens AC-25 (a malformed message is dead-lettered and the next one applied) and AC-38 (the demo page), both already `done`.
- INV: none
- Risk: medium. No new rule, but it changes what the treasury consumer writes when it refuses a message, the one path whose failure stalls a partition (A-13 clause 4). Runs on Opus per `CLAUDE.md §8`.
- Depends on: S-07.

## Why this slice exists

S-07 shipped over one major by Marcin's decision and carried eight minors; S-06 left one minor
open. They are listed in [[../log/changelog]] as known limitations. Marcin asked on 2026-09-25 to
fix all of them. None changes a requirement, so there is no `/spec` step; they are one slice
because they share the gate and the review.

## What the shipped code does today

Checked against `main` at 1d0b189, after S-07:

- `RejectTreasuryMessage.execute` publishes the dead letter, then writes the record with
  `programId`, `type`, `payload` and `error`. If the insert fails, `handle` rejects, the offset
  stays uncommitted and the message is delivered again, forever: the dead letter goes out on
  every delivery because `countIfKnown` finds no record.
- Postgres refuses `\u0000` in `jsonb` and in `varchar`/`text`. A payload with `\u0000` in any
  string (an unknown field, a refused `creditLimit`), or an id with `\u0000` in it, makes that
  insert fail. Reproduced by review round 2 of S-07: 53 dead letters in 10 s, the next message
  never applied.
- `readableString` (`infrastructure/messaging/readable-payload.ts`) accepts any non-empty string
  within the column length, NUL included.
- `storablePayload` drops the payload only when the parser threw. It relies on the parser and
  Prisma's JSON serialiser overflowing at the same nesting depth; review round 2 found depths
  (2 840 to 2 856) where the parser refuses without throwing and the serialiser still overflows.
- The DTOs accept `messageId` and `programId` with `\u0000`, so such a capacity update fails
  three attempts in the database before it is set aside, instead of being refused on sight.
- `web`: the generator keeps reserved invoices without their program; the poll has no guard
  against an answer for a program id that is no longer shown; a body that is not JSON is logged
  as `0 API_UNREACHABLE`; an empty `/dev/token` answer is cached for the page's life;
  `app.tsx` casts two response bodies with `as`; the "Stale" comment promises an outcome the
  consumer gives only for a program that has had an update; the generator's timer has no test.
- `reconciliation-at-the-bound.integration-test.ts` proves a snapshot at 10 000 entries, but a
  program's active reservations are not bounded by that number: a snapshot that omits more than
  10 000 of them has never been run.

## Scope

`api`, treasury consumer:

1. **A record the store can always write.** `storablePayload(payload)` moves to
   `readable-payload.ts` and becomes a property of the payload, not of how parsing ended: `null`
   when the payload nests deeper than `STORED_PAYLOAD_MAX_DEPTH` (32; a legal message nests 3)
   or when any string or key in it contains `\u0000`. The walk is iterative, so it cannot
   overflow on the input it is guarding against. Every rejection goes through it, parse
   failures and DTO refusals alike; the `unparseable` mark goes.
2. **Ids that fit the column include "no NUL".** `readableString` returns `null` for a string
   containing `\u0000`, so the record is written under no id (dead letter only), as for an id
   that is too long today.
3. **The error text is written without NUL.** Error strings can quote the input (a JSON parse
   error names what it found); `\u0000` is removed before the record and the failure row are
   written. The dead-letter header keeps the error as it was.
4. **The DTOs refuse NUL in identifiers.** `messageId`, `programId` and `invoiceId` in both
   message DTOs: a message carrying one is malformed on sight (A-13 clause 4), not after three
   failed attempts.

`api`, reconciliation at scale:

5. **Release by omission past the list bound.** A bound test with 20 000 active reservations
   (two snapshots of 10 000 at an earlier `asOf`) and a third snapshot listing none: all 20 000
   released by adjustment in one transaction. If it does not fit the 15 s transaction timeout,
   the implementation makes it fit (for example batching the reads); the test is the
   requirement, the mechanism is `/implement`'s.

`web`:

6. **The generator's invoices belong to a program.** Reserved invoices are kept per program id,
   so a release always goes to the program that holds the invoice; a `404` on release drops the
   invoice as well, since api says it is not there.
7. **A late poll answer is ignored.** The poll effect marks its run stale on cleanup and drops
   answers that arrive after it, so a program id change never shows the previous program.
8. **The log tells what api answered.** A body that is not JSON keeps its real status, with
   `code` empty; `API_UNREACHABLE` only when `fetch` itself failed. An empty token is not cached:
   the next call asks again.
9. **Bodies are narrowed, not cast.** Small type guards for availability and movements in
   `api.ts`, used by `app.tsx`; a body that does not match reads as "not there".
10. **The "Stale" comment says what happens:** stale for a program the treasury has updated
    since 2000; for a program id never announced it announces the program, which the ledger then
    shows.
11. **The generator's timer is tested.** With fake timers: Start sends a request each second
    across re-renders; Stop sends no more.

Housekeeping (`/ship`):

12. **Commit column.** Fill the commit column of `wiki/plan/plan.md` for S-04 to S-07 from their
    merge commits, as S-01 to S-03 are.

## Local decisions

1. **The payload is kept only when it is plainly storable.** The record exists to answer "what
   happened to message m-7"; the dead letter already keeps the original bytes (ADR-0003). Losing
   the payload of a pathological message costs nothing a reviewer needs; failing to write the
   record stalls a partition.
2. **Depth 32, not "whatever Prisma survives".** The limit is ours and far below any stack
   limit, so it does not move when Prisma, Node or the call stack changes (the coupling review
   round 2 of S-07 found).
3. **No catch-all around the record insert.** A database that is away must still propagate so
   the message is redelivered (ADR-0013). The fix removes the inputs that make the insert fail
   deterministically, rather than guessing which errors are the message's fault.

## Tests by name

Supporting tests, untagged: AC-25 and AC-38 were closed by S-02 and S-07 (`CLAUDE.md §4`).

| Test | Level | File | Closes |
|---|---|---|---|
| `it('should dead-letter and record a message with NUL in a string, and apply the next one on the real store')` | integration | `api/src/modules/capacity/infrastructure/messaging/treasury-capacity.consumer.integration-test.ts` | item 1, the major: an unknown field `"a\u0000b"` and a `programId` with NUL, each recorded `rejected`, the next message applied |
| `it('should keep a payload that is plainly storable and drop one nested too deep or carrying NUL')` | unit | `api/src/modules/capacity/infrastructure/messaging/readable-payload.test.ts` | items 1 and 2: depth 3 kept, depth 33 and 2 850 dropped, NUL in a value and in a key dropped |
| `it('should not read an id that contains NUL')` | unit | `api/src/modules/capacity/infrastructure/messaging/readable-payload.test.ts` | item 2 |
| `it('should refuse identifiers that contain NUL')` | unit | `capacity-update-message.dto.test.ts`, `reconciliation-snapshot-message.dto.test.ts` | item 4 |
| `it('should release by omission more active reservations than the list bound in one transaction')` | integration | `api/src/modules/capacity/infrastructure/persistence/reconciliation-at-the-bound.integration-test.ts` | item 5 |
| `it('should release each invoice on the program that holds it after the program id changes')` | render | `web/src/generator.test.tsx` | item 6 |
| `it('should ignore a poll answer for a program id no longer shown')` | render | `web/src/app.test.tsx` | item 7 |
| `it('should log the real status of an answer that is not JSON and ask for a token again after an empty one')` | unit | `web/src/api.test.ts` | item 8 |
| `it('should show no availability for a body that is not one')` | render | `web/src/app.test.tsx` | item 9 |
| `it('should send a request every second while running and none after stop')` | render | `web/src/generator.test.tsx` | item 11 |

Item 10 is a comment, item 12 a table; neither has a test.

## ADR candidates

None. The three local decisions follow from A-13 clause 4 and ADR-0003 and ADR-0013 as accepted.

## Definition of done

Beyond `CLAUDE.md §9`:

- The changelog row for S-08 names every carried finding it closes, with its origin (review
  round and slice), and says if any stays open.
- `wiki/Home.md` lists no known limitation from the reviews, or names the ones left.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-25 | plan | slice written for the S-06 and S-07 carried findings, at Marcin's request |
| 2026-09-25 | implement | started on Opus |
| 2026-09-26 | implement | done: items 1 to 11, npm run gate green |
| 2026-09-26 | verify | PASS: gate green, all ten planned tests present and passing, cold start and README green |
| 2026-09-26 | review (round 1) | 4 findings (0/2/2) |
| 2026-09-26 | implement (round 2) | review round 1: both majors and the web minor fixed; the plan-text minor goes to ship |
