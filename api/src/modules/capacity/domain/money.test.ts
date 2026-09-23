import {CurrencyMismatchError} from './errors';
import {Money} from './money';
import {Rate} from './rate';

const USD = 'USD';
const EUR = 'EUR';
const JPY = 'JPY';
const KWD = 'KWD';

describe('Money', () => {
  it('should hold integer minor units with a currency and never a float', () => {
    const money = Money.of(120_000_000n, USD);

    expect(money.amount).toBe(120_000_000n);
    expect(money.currency).toBe(USD);
  });

  it('should add and subtract amounts of the same currency', () => {
    const limit = Money.of(1_000_000_000n, USD);
    const reserved = Money.of(400_000_000n, USD);

    expect(limit.subtract(reserved)).toEqual(Money.of(600_000_000n, USD));
    expect(reserved.add(reserved)).toEqual(Money.of(800_000_000n, USD));
  });

  it('should refuse to combine two currencies', () => {
    const usd = Money.of(100n, USD);
    const eur = Money.of(100n, EUR);

    expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.subtract(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.compare(eur)).toThrow(CurrencyMismatchError);
  });

  it('should compare amounts of the same currency', () => {
    expect(Money.of(1n, USD).compare(Money.of(2n, USD))).toBeLessThan(0);
    expect(Money.of(2n, USD).compare(Money.of(2n, USD))).toBe(0);
    expect(Money.of(3n, USD).compare(Money.of(2n, USD))).toBeGreaterThan(0);
  });

  it('should refuse a negative amount, because capacity is never negative', () => {
    expect(() => Money.of(-1n, USD)).toThrow(RangeError);
    expect(() => Money.of(1n, USD).subtract(Money.of(2n, USD))).toThrow(RangeError);
  });

  it('should know zero in a currency', () => {
    expect(Money.zero(EUR)).toEqual(Money.of(0n, EUR));
    expect(Money.zero(EUR).isZero()).toBe(true);
  });

  it('[INV-08] should keep money as integer minor units with a currency, refuse cross-currency arithmetic and round conversions half up', () => {
    // No amount without a currency, and an amount is a bigint: a number does not compile.
    // @ts-expect-error INV-08: amounts are integer minor units, never a float type
    Money.of(1, USD);

    const usd = Money.of(100n, USD);
    expect(() => usd.add(Money.of(100n, EUR))).toThrow(CurrencyMismatchError);
    expect(() => usd.subtract(Money.of(100n, EUR))).toThrow(CurrencyMismatchError);
    expect(() => usd.compare(Money.of(100n, EUR))).toThrow(CurrencyMismatchError);

    // Half up on the last minor unit, the one rule for every conversion (A-10, ADR-0006).
    expect(Money.of(100n, EUR).convert(Rate.parse('1.005'), USD)).toEqual(Money.of(101n, USD));
    expect(Money.of(100n, EUR).convert(Rate.parse('1.004'), USD)).toEqual(Money.of(100n, USD));
    expect(Money.of(275_000_000n, EUR).convert(Rate.parse('1.10'), USD)).toEqual(
      Money.of(302_500_000n, USD),
    );

    // Each currency's own minor unit: JPY counts whole yen, KWD counts thousandths (A-10).
    expect(Money.of(1_000n, JPY).convert(Rate.parse('0.0067'), USD)).toEqual(Money.of(670n, USD));
    expect(Money.of(100n, USD).convert(Rate.parse('0.30712'), KWD)).toEqual(Money.of(307n, KWD));
    expect(Money.of(307n, KWD).convert(Rate.parse('3.2560'), USD)).toEqual(Money.of(100n, USD));

    // The same currency at one is the identity, so the use case needs no second path.
    expect(Money.of(120_000_000n, USD).convert(Rate.one(), USD)).toEqual(
      Money.of(120_000_000n, USD),
    );

    // No float reaches a rate either: the API takes a decimal string and the domain parses it.
    expect(() => Rate.parse('1.123456789')).toThrow(RangeError);
    expect(() => Rate.parse('0')).toThrow(RangeError);
  });
});
