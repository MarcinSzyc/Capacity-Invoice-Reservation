# S-04 Cross-currency reservations

- Outcome: a client reserves an invoice denominated in another currency than the program by supplying the rate; the service converts once, half up, into the program's minor unit, stores the rate on the reservation and never mixes currencies anywhere else.
- Status: done 2026-09-23
- AC: AC-06, AC-07
- INV: INV-08
- Risk: high. Money arithmetic: an integer amount times a decimal rate across two minor unit exponents, rounded half up, in `bigint` with no float anywhere. Small slice, but per `CLAUDE.md §8` money is Fable work.
- Depends on: S-03 (done 2026-09-22). ADR: [[../decisions/ADR-0006-money-and-rate-representation]], accepted 2026-09-21, decides `Rate` (decimal string, unscaled `bigint` plus scale of at most 8, `NUMERIC(20,8)`) and half-up rounding. No other ADR is needed before `/implement`.

## Revision of 2026-09-22

The slice was first written on 2026-09-19, before any code existed. S-03 has shipped since
(tag `S-03`, merge 2d159f6) and this revision reconciles the file with what it left behind, so
that `/implement` runs without a design conversation. What changed against the first version:

- The error envelope is the one S-02 and S-03 shipped: validation failures are
  `400 VALIDATION_FAILED` with `details` as a list of messages that each start with the field
  name. The first version wrote `details.fields`, which does not exist.
- The rule of AC-07 needs the program's currency, which no DTO can see, so it is judged in the
  use case and answered through a new domain error kind that the filter maps to `400`
  (decision 1). The first version put a cross-field validator on the DTO, which cannot work.
- Conversion respects the minor unit exponent of both currencies: JPY has 0 decimals, KWD 3,
  most codes 2. Neither A-10 nor ADR-0006 said so; Marcin decided on 2026-09-22 that the domain
  carries the ISO 4217 exponent table (decision 2). A-10 needs the sentence from `/spec`.
- `rate` reads back in canonical form, `"1.1"` for a sent `"1.10"` and `"1"` for a same-currency
  reservation; decided by Marcin on 2026-09-22 (decision 3). AC-06's test asserts `"1.1"`.
- S-03 shipped `Reservation` with three `Money` amounts and no rate, a `reservations.currency`
  column, `ReserveCapacity` with the interim `422 CURRENCY_MISMATCH` and the `IsCurrencyCode()`
  decorator on every currency field. This slice extends those rather than redesigning them,
  and removes the interim rule together with its untagged e2e test.
- A conversion that rounds to zero minor units cannot reach `Program.reserve`, which throws a
  `RangeError` (a `500`) on a zero `held`; it is refused as a validation failure first
  (decision 4).

## Scope

Module `src/modules/capacity/`, as in S-03. Nothing in `web` changes in this slice.

Domain (`domain/`):
- `Rate` value object in `rate.ts` (ADR-0006): `Rate.parse(text)` accepts `^\d{1,12}(\.\d{1,8})?$`
  and a numerically positive value, holds `unscaled: bigint` and `scale: number` (0 to 8), and
  refuses anything else with a `RangeError` (the DTO stops malformed input on HTTP; the domain
  refuses it too, the way `Program.reserve` refuses a zero). `Rate.one()`; `isOne()` compares
  numerically, so `"1"`, `"1.0"` and `"1.00"` are all one; `toString()` renders the canonical
  form: trailing fractional zeros removed, no fractional part for an integer (`"1.1"`, `"1"`,
  `"0.0067"`); `equals(other)` is numeric. Immutable.
- `currency-exponents.ts`: `minorUnitExponent(code): number`, a lookup with the ISO 4217
  exceptions and a default of 2. Zero decimals: BIF, CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG,
  RWF, UGX, UYI, VND, VUV, XAF, XOF, XPF. Three decimals: BHD, IQD, JOD, KWD, LYD, OMR, TND.
  Four decimals: CLF, UYW. Everything else, including the codes ISO lists without a minor unit
  (XAU, XTS, XXX), is 2. Source: the ISO 4217 list as published by SIX, current at planning
  time; the file cites it. A new domain word, so `/spec` gives the glossary `Minor unit` or
  `Currency exponent` before `/review`.
- `Money.convert(rate, targetCurrency): Money`, the only cross-currency operation in the domain
  (INV-08): `numerator = amount × rate.unscaled × 10^exp(target)`,
  `divisor = 10^(rate.scale + exp(source))`, result `(numerator + divisor / 2n) / divisor` in
  `bigint`, which is half up toward positive infinity for the non-negative amounts `Money`
  allows. With `divisor` 1 (an integer rate between two zero-decimal currencies) the half is
  `0n` and nothing rounds. Same currency at rate one returns an equal amount, so the use case
  has one path. Examples the tests pin: 275 000 000 EUR minor at `1.10` → 302 500 000 USD
  minor; 100 EUR minor at `1.005` → 101, at `1.004` → 100; 1 000 JPY (1 000 minor, exponent 0)
  at `0.0067` → 670 USD minor; 100 USD minor at `0.30712` → 307 KWD minor (exponent 3, from
  307.12); 307 KWD minor at `3.2560` → 100 USD minor (from 99.96).
- `Reservation`: `rate: Rate` joins `ReservationState`, `OpenReservation` and `describe()`
  (as the canonical string). `held` still starts equal to `reservedAmount`; the caller
  computes `reservedAmount = invoiceAmount.convert(rate, programCurrency)`.
- `errors.ts`: `RateValidationError extends DomainError` with `kind: 'invalid'`, `code`
  `VALIDATION_FAILED`, a `field` (`rate` or `invoiceAmount`) and a message; rendered by the
  filter as a validation failure (decision 1). `CurrencyMismatchError` stays: `Money` and
  ADR-0007 use it; only the interim throw in `ReserveCapacity` goes.
- `common/errors/domain-error.ts`: `DomainErrorKind` gains `'invalid'`; the constant
  `VALIDATION_FAILED` moves next to it so the domain and the filter name one string.

Application (`application/`):
- `ReserveCapacityCommand` gains `rate: Rate | null` (the controller parsed it; a missing field
  is `null`). `ReserveCapacity.execute`, still one transaction behind the row lock (ADR-0008):
  lock, not found, duplicate before capacity as before, then the rate rule: currencies differ
  and `rate` is `null` → `RateValidationError('rate', 'is required when invoiceCurrency EUR
  differs from the program currency USD')`; currencies equal and `rate` is not one →
  `RateValidationError('rate', 'must be 1 or absent when invoiceCurrency equals the program
  currency')`; then `reservedAmount = invoiceAmount.convert(rate ?? Rate.one(), program.currency)`;
  if it is zero → `RateValidationError('invoiceAmount', 'converts to nothing in USD at rate
  0.0001')` (decision 4); then open, reserve, append, save as in S-03. The interim
  `CurrencyMismatchError` throw and its comment are deleted. Order: the duplicate check stays
  before the rate rule, so a repeated invoice is a `409` whatever it sends (AC-05 unchanged).
- Fakes: `InMemoryReservations` needs nothing new; `Reservation.rehydrate` in tests gains
  `rate`.

Infrastructure (`infrastructure/`):
- Migration `reservation_rate`: `ALTER TABLE reservations ADD COLUMN rate NUMERIC(20,8) NOT NULL
  DEFAULT 1; ALTER TABLE reservations ALTER COLUMN rate DROP DEFAULT;` in one file. The default
  backfills every S-03 row as a same-currency reservation at one (the only kind S-03 could
  create) and is dropped at once so a mapper that forgets the rate fails the insert instead of
  silently booking at one (decision 5). Prisma: `rate Decimal @db.Decimal(20, 8)`. Generated the
  way S-03 generated its migration, with the `DROP DEFAULT` appended by hand.
- `mappers.ts`: `Rate.parse(row.rate.toString())` on the way out and
  `new Prisma.Decimal(rate.toString())` on the way in; the round trip test pins `"1.1"` and
  `"0.0067"` through `NUMERIC(20,8)` (decimal.js drops trailing zeros, `Rate.parse`
  canonicalises anyway).
- `ReserveRequestDto` gains `rate?: string`: `@IsOptional()`, `@IsString()`,
  `@Matches(/^\d{1,12}(\.\d{1,8})?$/, {message: 'rate must be a decimal with at most 8 fractional
  digits'})` and a custom positivity check whose message starts with `rate ` (`"0"`, `"0.000"`
  refused). `@ApiProperty({type: String, required: false, example: '1.10', description: 'Invoice
  currency to program currency, a decimal string with at most 8 fractional digits. Required
  when invoiceCurrency differs from the program currency, absent or 1 otherwise. Reads back in
  canonical form (A-02, ADR-0006).'})`. A JSON number `1.1` is refused by `@IsString()`, so the
  contract never says float (INV-08).
- `ReservationDto` gains `rate!: string` with `@ApiProperty({type: String, example: '1.1',
  description: 'Invoice currency to program currency, canonical decimal; 1 for a same-currency
  reservation.'})`. The S-02 documentation test that checks every money field is `integer` must
  not list `rate`; a new case asserts `ReservationDto.rate` is `string` (INV-08's schema half).
- `ProgramsController.reserve`: maps `body.rate` to `Rate.parse(body.rate)` or `null`; nothing
  else changes. `@ApiBadRequestResponse` description names AC-07 next to AC-08.
- `error-body.ts`: `STATUS_BY_KIND.invalid = 400`; an `invalid` domain error renders as
  `{statusCode: 400, code: 'VALIDATION_FAILED', message, details: ['rate is required ...']}`,
  indistinguishable in shape from a DTO validation failure. One unit case in
  `error-body.test.ts`.
- e2e support: `reserve(programId, body)` is unchanged; `body` may carry `rate`. A `EUR`
  constant already exists in `test/support/programs.ts`; `JPY` and `KWD` join it for the
  exponent case.
- `dev-treasury-producer` and the consumer: untouched, a capacity update carries no rate.

## Decisions fixed by this revision

Local choices with alternatives that were considered. Decisions 2 and 3 were put to Marcin
on 2026-09-22 and are recorded here as his; the rest are the planner's, none large enough
for an ADR. Recorded so review can hold the code to them.

1. **AC-07's `400` comes from the use case through a domain error kind `invalid`.**
   Alternatives: (a) a cross-field validator on the DTO, impossible because the DTO cannot see
   the program's currency; (b) the controller reading the program first, which puts repository
   access in a controller (`CLAUDE.md §2`); (c) a result type returned from the use case,
   declined because S-03 decision 6 fixed "errors the client must see are thrown as
   `DomainError`s and the filter maps them"; (d) answering `422`, which contradicts AC-07.
   The kind is generic (`invalid`: the request is well formed but wrong against state the
   client could have known), the filter maps it to `400` and renders it as `VALIDATION_FAILED`
   with `details`, so a client sees one shape for every validation failure. S-03 decision 2
   left this open for S-04; this closes it.
2. **The domain carries the ISO 4217 minor unit exponents.** Marcin's decision. Alternatives:
   treating every currency as two decimals (wrong by a factor of 100 for JPY, 10 for KWD) or
   refusing conversions outside two-decimal currencies with a stable code. The table is about
   25 exceptions with a default of 2 and lives in `domain/`, no port, because it is a fact
   about the codes, not about any adapter. A-10 gains a sentence via `/spec`.
3. **`rate` reads back canonical.** Marcin's decision. Alternative: exactly as sent, which
   needs the sent scale stored next to the `NUMERIC` column for presentation only. Canonical
   costs nothing: `Rate.toString()` strips trailing fractional zeros, ADR-0006 already
   compares rates numerically, and the OpenAPI description says so.
4. **A conversion that rounds to zero is a `400` naming `invoiceAmount`.** Alternative: let
   `Program.reserve` throw its `RangeError`, which the filter turns into a `500`. Declined
   because the client can know the rate makes the amount vanish, so it is their error, and the
   message names both the rate and the target currency. `422` was considered and declined
   because nothing about program state is involved. Same-currency reservations cannot hit it:
   `@Min(1)` on `invoiceAmount` and rate one keep the amount.
5. **`DEFAULT 1` added and dropped in one migration.** Alternative: keep the default. Declined
   because a default hides a mapper that forgets the rate: every row would silently book at
   one. The default exists only to backfill S-03's rows, which were all same-currency and so
   are correctly one. The gate cannot prove the backfill on a populated database (Testcontainers
   start empty), so the cold start smoke proves the migration applies and the integration
   round trip proves the column; the backfill correctness is by construction and is said so in
   the work-log.
6. **One conversion path.** Alternative: skip `convert` when the currencies are equal.
   Declined because `convert` at rate one between equal currencies is the identity (equal
   exponents, divisor one) and one path means the same-currency case is covered by the same
   tests as the cross-currency one. INV-08 holds either way: the only arithmetic across
   currencies is `convert` and it always has a rate.
7. **`Rate` parses in the controller, not in the DTO.** Alternative: a `@Transform` to a
   `Rate` on the DTO. Declined because class-transformer would then hand the validators a
   `Rate` instance and every `@Matches` would need rewriting; the S-03 pattern (`bigint` from
   the JSON integer) also converts in the controller after validation. The DTO keeps the
   string and the format rule; the controller does one `Rate.parse`.
8. **Exponent of an unknown or unusual code is 2.** Alternative: refuse a code the table does
   not list. Declined because `IsCurrencyCode()` already limits input to the ISO list, so the
   only unlisted codes are the ones ISO marks "no minor unit" (XAU, XTS, XXX), and refusing
   them would need a stable code for a case no client of this brief has. Two decimals is the
   ISO default and is what the table says explicitly.
9. **The interim `CURRENCY_MISMATCH` e2e test is deleted, not kept.** It was written as
   "until S-04 brings the rate" and AC-07 replaces its behaviour; keeping it would assert the
   old answer. Its `extra` row in `wiki/plan/plan.md` is marked superseded by AC-07 rather than
   removed, so the history of the requirement stays readable in the file.

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-06] should convert a EUR invoice at the given rate, store the rate and reduce availability by the converted amount')` | e2e | `PRG` in USD with 10 000 000.00; reserve `INV-B` 275 000 000 EUR minor at `rate` `"1.10"`: `201` body has `invoiceAmount` 275 000 000, `invoiceCurrency` EUR, `reservedAmount` and `held` 302 500 000, `rate` `"1.1"`, `status` `active`; availability reads `reserved` 302 500 000, `available` 697 500 000; ledger helper green (the reserve row is in USD) |
| `it('[AC-07] should answer 400 naming rate when it is missing for a cross-currency reservation or not 1 for a same-currency one')` | e2e | two requests on a USD program: 275 000 000 EUR without `rate`; 120 000 000 USD with `rate` `"1.05"`; each `400 VALIDATION_FAILED` with a `details` entry starting with `rate `; availability unchanged, no reservation. Then 120 000 000 USD with `rate` `"1.00"`: `201`, `rate` reads `"1"` |
| `it('[INV-08] should keep money as integer minor units with a currency, refuse cross-currency arithmetic and round conversions half up')` | unit | `Money.add`, `subtract` and `compare` across currencies throw `CurrencyMismatchError`; `convert` at `1.005` rounds 100 to 101 and at `1.004` to 100; 275 000 000 EUR at `1.10` is 302 500 000 USD; 1 000 JPY at `0.0067` is 670 USD minor; 100 USD minor at `0.30712` is 307 KWD minor and 307 KWD minor at `3.2560` is 100 USD minor; a `// @ts-expect-error` line shows `Money.of` refuses a `number`; `Rate.parse` refuses `"1.123456789"`, `"0"`, `"-1"`, `"abc"`, `""` |
| `it('[INV-08] should publish rate as a string and every amount as an integer (ADR-0006)')` | e2e (docs) | in `api/test/docs.e2e-test.ts`: `ReservationDto.rate` and `ReserveRequestDto.rate` are `type: string` in the OpenAPI document, next to the existing check that no money field is a `number` |

Supporting tests expected beyond the plan (untagged, listed in `wiki/plan/plan.md` by `/ship`):
`Rate` parses, canonicalises (`"1.10"` → `"1.1"`, `"1.00"` → `"1"`, `"0.00670000"` →
`"0.0067"`), `isOne` numerically, and refuses the malformed and non-positive; `minorUnitExponent`
answers 0 for JPY, 3 for KWD, 4 for CLF, 2 for USD and for XXX; `Reservation.open` carries the
rate and `describe()` renders it canonical; `ReserveCapacity` against the fakes: cross-currency
stores the rate and books the converted amount, same-currency stores one whether `rate` is
absent or `"1.0"`, missing and superfluous rate are `RateValidationError`s naming `rate` with
nothing written, a rate that converts the amount to nothing names `invoiceAmount`, and the
duplicate check still runs before the rate rule; the filter renders an `invalid` domain error as
`400 VALIDATION_FAILED` with `details`; the Prisma round trip keeps `"1.1"` and `"0.0067"`
through `NUMERIC(20,8)` and an insert without a rate fails; e2e: `rate` as a JSON number, as
`"abc"`, `"0"` or with nine decimals is `400` naming `rate` (untagged: AC-07 names two cases and
these are format, which AC-08 does not list either).

## ADR candidates

- [[../decisions/ADR-0006-money-and-rate-representation]]: accepted 2026-09-21; the rate part
  applies here unchanged (decimal string, unscaled `bigint` and scale, `NUMERIC(20,8)`, half up).
  Nothing new: the exponent rule and the canonical rendering are amendments to A-10 (spec),
  decided by Marcin on 2026-09-22, and every other decision above is local.

## Definition of done

Beyond `CLAUDE.md §9`:

- The interim `422 CURRENCY_MISMATCH` on reserve is gone from `ReserveCapacity`, its e2e test
  is deleted and its `extra` row in `wiki/plan/plan.md` says so.
- README shows the cross-currency reserve request with `rate` and the `400` it gets without one
  (A-02 asks for it); the `CURRENCY_MISMATCH` row of the reservation error table goes, because
  a reservation can no longer produce it.
- `/spec` before `/review`: A-10 gains the exponent rule and the canonical rendering of `rate`
  (with a Changes row), and the glossary gains `Minor unit` (or `Currency exponent`) with a JPY
  and a KWD example. `Conversion rate` already exists and matches the field name `rate`.
- The INV-08 `@ts-expect-error` line is in a unit test file, not in `src/` code.

## Hand-off notes for later slices

- S-05: `Money.convert` and the stored `Rate` are what a release in invoice currency converts
  with (A-08); exact closing of the last instalment is ADR-0009's, not `convert`'s: `convert`
  rounds every call independently and never knows what is left. `Reservation.rate` is
  immutable; the read endpoint renders it with `describe()`.
- S-06: a reservation created by reconciliation (ADR-0011) needs a rate too; the snapshot
  carries `heldAmount` in program currency and no invoice amount, so that ADR has to say what
  `invoiceAmount`, `invoiceCurrency` and `rate` are for such a row (program currency and one is
  the obvious answer, and then `invoiceAmount` equals `heldAmount` at creation).
- S-07: the demo page shows `rate` as the string the API returns; it computes nothing.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
| 2026-09-22 | plan | revised against the shipped S-03 code; exponent table and canonical `rate` decided by Marcin; nine local decisions, no new ADR |
| 2026-09-22 | implement | started on Opus; `risk: high` would put this on Fable per `CLAUDE.md §8`, Marcin decided to run it on Opus |
| 2026-09-22 | verify | PASS, gate green on 7c6a0f8, 3/3 AC and INV covered at the planned level, cold start and the AC-06 and AC-07 behaviour confirmed live; 1 minor owed to `/ship` (README still lists `CURRENCY_MISMATCH` for a reservation and has no cross-currency example) |
| 2026-09-23 | review | 6 findings (0 blockers / 2 majors / 4 minors), not a pass; run on Opus because the Fable credits ran out, so the review model was the implementation model; majors: a rate below 1e-7 reads back from `NUMERIC(20,8)` in exponential notation and throws out of the mapper (`500`), and `"rate": null` passes `@IsOptional()` and reaches `Rate.parse` (`500` instead of AC-07's `400`) |
| 2026-09-23 | verify | PASS (second pass), gate green on 5dfc519, 3/3 AC and INV covered at the planned level, both round 1 majors confirmed fixed live on a cold started stack (a rate of `0.00000001` reads back whole and a repeat is `409`, `"rate": null` is `400`); 2 documentation findings owed to `/ship` (README row and example, `plan.md:104`) |
| 2026-09-23 | review | PASS (round 2), 5 findings (0 blockers / 0 majors / 5 minors); run on Opus again because the Fable credits are exhausted, so the review model was still the implementation model; both round 1 majors confirmed closed at the mechanism, not just at the test, and neither fix introduced a problem; minors: AC-06 proves storage only in an untagged integration test, no `CHECK ("rate" > 0)` on the new column, the planned JPY and KWD e2e constants never landed, two inline `EUR` literals, and the glossary still teaches a `RateProvider` that A-02 declined |
| 2026-09-23 | verify | PASS (third pass), gate green on 443c5d0, 3/3 AC and INV covered at the planned level, the stored rate and the exponent rule both confirmed live over HTTP (1 000 JPY at `0.0067` is 670, and the repeat `409` carries the stored rate); 4 findings owed to `/ship` (migration CHECK, glossary `RateProvider` examples, README, `plan.md:104`) |
| 2026-09-23 | ship | changelog, requirement checklist (3 rows done, 8 extra rows), slice index, Home and README (cross-currency example with `rate`, the `CURRENCY_MISMATCH` row dropped, both run literally on a fresh stack); ADR-0006 already accepted; 2 findings carried to S-05 |
