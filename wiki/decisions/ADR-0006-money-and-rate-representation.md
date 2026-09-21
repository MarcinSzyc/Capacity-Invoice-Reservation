# ADR-0006: Money and rate representation across API, domain and storage

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-21
- Slice: S-02 (Money), S-04 (Rate and conversion)
- Related: A-02, A-10, AC-06, AC-07, AC-08, AC-12, INV-08

## Context

Amounts are integer minor units plus an ISO 4217 code, never a float (INV-08, `CLAUDE.md §2`).
Conversion multiplies an invoice amount by a client-supplied rate such as `1.10` and rounds
half up (A-10). The rate must be stored exactly and reused for every release (A-02). Three
surfaces must agree: JSON on the API, the `Money` value object in the domain, columns in
Postgres. JavaScript `number` is a double: exact for integers below 2^53, never exact for
`1.10`.

## Options

### Amount type in the domain
**Option 1: `bigint`.** Exact for any size, arithmetic operators work, JSON needs explicit
serialisation. **Option 2: `number` guarded by `Number.isSafeInteger`.** Simpler JSON, but a
`number` in the domain is a float type by construction and INV-08 says "no float representation
appears in the domain".

### Amount on the API
**Option A: JSON integer** (`120000000`). Natural for clients, safe below 2^53 which is 90
trillion in cents. **Option B: JSON string** (`"120000000"`). Safe at any size, awkward for
clients and for Swagger "try it".

### Rate
**Option I: decimal string on the API (`"1.10"`), parsed into a `Rate` value object holding an
unscaled `bigint` and a scale (max 8 decimals), stored as NUMERIC(20,8).** Exact everywhere.
**Option II: JSON number on the API.** `1.10` arrives as the double nearest to 1.1; converting
through `toString()` recovers `"1.1"` for typical rates but the contract would say "float" and
INV-08 forbids it on the API too.

### Rounding
Half up on the last minor unit: `(unscaled * amount + halfDivisor) / divisor` in `bigint`
arithmetic, toward positive infinity for positive values. Applied once per conversion.

## Recommendation

Option 1, Option A, Option I: `bigint` in the domain, integer JSON on the API with
`@IsInt() @Min(1)` and a transformer to `bigint`, BIGINT columns; rate as a decimal string with
at most 8 decimals, `Rate` value object, NUMERIC(20,8) column; half-up rounding implemented in
`Money.convert` and covered by INV-08's unit tests. Same-currency reservations accept no rate
or exactly `"1"` (also `"1.0"`, compared numerically).

## Decision

Option 1, Option A and Option I, as recommended. Decided by Marcin on 2026-09-21.

- **Domain: `bigint`.** Amounts are integer minor units in a `Money` value object holding a
  `bigint` and an ISO 4217 code. `number` was declined because it is a float type by
  construction, and INV-08 says no float representation appears in the domain: a rule that
  holds only below 2^53 is not an invariant, it is a range.
- **API: JSON integer**, validated with `@IsInt()` and transformed to `bigint` at the DTO
  boundary. `120000000` is 1 200 000.00 USD. A JSON string would be safe at any size but makes
  every client parse before arithmetic, and the safe integer ceiling is ninety trillion in
  cents, far outside this brief.
- **Rate: a decimal string** on the API (`"1.10"`), parsed into a `Rate` value object holding
  an unscaled `bigint` and a scale of at most 8 decimals, stored as `NUMERIC(20,8)`. A JSON
  number was declined because `1.10` arrives as the nearest double and the published contract
  would then say "float", which INV-08 forbids on the API as much as in the domain.
- **Rounding: half up** on the last minor unit, once per conversion, in `bigint` arithmetic:
  `(unscaled * amount + halfDivisor) / divisor`, toward positive infinity for positive values.
  Implemented once in `Money.convert` and covered by INV-08's unit tests.
- **Same currency reservations** carry no rate, or exactly `"1"`, with `"1.0"` and `"1.00"`
  accepted because the comparison is numeric rather than textual.

Storage follows: money columns are `BIGINT`, rate columns `NUMERIC(20,8)`, per ADR-0002.

## Consequences

Every DTO amount field is `integer` in the OpenAPI document; the demo page and README show
minor units (`120000000` for 1 200 000.00 USD). The domain never imports a decimal library;
`Rate` is small enough to write by hand and test exhaustively.

`bigint` costs something at every boundary that serialises, and S-01 already paid the first
instalment: `JSON.stringify` throws on a `bigint`, so the JSON logger needed a replacer before
it could log a reservation at all. Expect the same at the DTO boundary, in Prisma results and
anywhere a test compares a response body. That is the price of the guarantee, and it is paid
in one place each time rather than by rounding somewhere unnoticed.
