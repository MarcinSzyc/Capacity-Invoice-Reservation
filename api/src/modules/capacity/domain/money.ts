import {CurrencyMismatchError} from './errors';

/**
 * An amount of money: integer minor units (ADR-0006, `bigint`) plus an ISO 4217 code. Two
 * amounts combine only in the same currency; conversion arrives with `Rate` in S-04 and is the
 * only place a currency ever changes (INV-08).
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

  private assertSameCurrency(other: Money, operation: string): void {
    if (other.currency === this.currency) return;
    throw new CurrencyMismatchError(this.currency, other.currency, `Money.${operation}`);
  }
}
