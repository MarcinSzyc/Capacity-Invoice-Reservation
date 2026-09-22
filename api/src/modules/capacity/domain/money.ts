import {minorUnitExponent} from './currency-exponents';
import {CurrencyMismatchError} from './errors';
import {Rate} from './rate';

const TEN = 10n;

const power = (exponent: number): bigint => TEN ** BigInt(exponent);

/**
 * An amount of money: integer minor units (ADR-0006, `bigint`) plus an ISO 4217 code. Two
 * amounts combine only in the same currency; `convert` is the only place a currency ever
 * changes, and it always needs a rate (INV-08).
 */
export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: string,
  ) {}

  static of(amount: bigint, currency: string): Money {
    if (amount < 0n) throw new RangeError(`Money cannot be negative, got ${amount} ${currency}`);
    return new Money(amount, currency);
  }

  static zero(currency: string): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, 'add');
    return new Money(this.amount + other.amount, this.currency);
  }

  /** Never goes below zero: the caller decides what a shortfall means, this refuses to hide it. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other, 'subtract');
    return Money.of(this.amount - other.amount, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  compare(other: Money): number {
    this.assertSameCurrency(other, 'compare');
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  isZero(): boolean {
    return this.amount === 0n;
  }

  /**
   * A-10: one conversion, rounded half up to the target's minor unit. Both currencies bring
   * their own exponent, so a JPY amount (no decimals) and a KWD one (three) convert correctly
   * rather than as if everything had two. All of it in `bigint`: the half is added before the
   * single division, which rounds up on a tie for the non-negative amounts `Money` allows.
   */
  convert(rate: Rate, targetCurrency: string): Money {
    const numerator = this.amount * rate.unscaled * power(minorUnitExponent(targetCurrency));
    const divisor = power(rate.scale + minorUnitExponent(this.currency));
    return Money.of((numerator + divisor / 2n) / divisor, targetCurrency);
  }

  private assertSameCurrency(other: Money, operation: string): void {
    if (other.currency === this.currency) return;
    throw new CurrencyMismatchError(this.currency, other.currency, `Money.${operation}`);
  }
}
