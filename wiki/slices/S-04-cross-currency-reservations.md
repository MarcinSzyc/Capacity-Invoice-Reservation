# S-04 Cross-currency reservations

- Outcome: a client reserves an invoice denominated in another currency by supplying the rate; the service converts once, half up, stores the rate and never mixes currencies.
- Status: planned
- AC: AC-06, AC-07
- INV: INV-08
- Risk: high. Money arithmetic: multiplication by a decimal rate with half-up rounding in integer arithmetic, no float anywhere. Small slice, but per `CLAUDE.md §8` money is Fable work.
- Depends on: S-03. ADR: [[../decisions/ADR-0006-money-and-rate-representation]] (accepted in S-02, the rate part applies here).

## Scope

Domain:
- `Rate` value object per ADR-0006: exact decimal from a string (`"1.10"`), positive, bounded scale. `Money.convert(rate, targetCurrency)` returns Money in the target currency rounded half up to the minor unit; it is the only cross-currency operation in the domain.
- `Reservation` creation: `reservedAmount = invoiceAmount.convert(rate, program.currency)`; `held` starts equal to it; the rate is stored and immutable.
- Validation rule (A-02, A-10): different currencies require `rate`; same currency requires `rate` absent or exactly `1`.

Infrastructure:
- Reserve DTO: `rate` optional decimal string, validated by a custom class-validator constraint; cross-field rule implemented as a DTO-level validator so the `400` names `rate`.
- The `reservations.rate` column holds the exact decimal (NUMERIC).

## Tests by name

| Test | Level | Notes |
|---|---|---|
| `it('[AC-06] should convert a EUR invoice at the given rate, store the rate and reduce availability by the converted amount')` | e2e | 2 750 000 EUR at `"1.10"` on a USD program: `reservedAmount` and `held` 3 025 000 USD, `rate` `"1.10"` in the body, availability down by 3 025 000 |
| `it('[AC-07] should answer 400 naming rate when it is missing for a cross-currency reservation or not 1 for a same-currency one')` | e2e | EUR without rate; USD with `"1.05"`; both `details.fields` name `rate` |
| `it('[INV-08] should keep money as integer minor units with a currency, refuse cross-currency arithmetic and round conversions half up')` | unit | `Money.add` across currencies throws; `convert` of 1 EUR at `1.005` rounds to 101 minor units, at `1.004` to 100; no `number` amount type in the domain (compile-time, asserted by a `ts-expect-error` line); the OpenAPI document declares every amount as `integer` and `rate` as `string` |

## ADR candidates

None new. ADR-0006 must state the rate scale and the rounding rule before this slice starts.

## Definition of done

Beyond `CLAUDE.md §9`:

- README shows the cross-currency reserve request with `rate` (A-02 asks for it).
- Glossary entries `Conversion rate` and the amounts table match the field names in the API exactly.

## Log

| Date | Gate | Result |
|---|---|---|
| 2026-09-19 | plan | slice written |
