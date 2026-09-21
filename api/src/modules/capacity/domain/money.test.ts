import {CurrencyMismatchError} from './errors';
import {Money} from './money';

const USD = 'USD';
const EUR = 'EUR';

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
});
