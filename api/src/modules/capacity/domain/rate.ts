const DECIMAL = /^\d{1,12}(\.\d{1,8})?$/;
const TEN = 10n;

/**
 * The conversion rate of one reservation (glossary), exact: an unscaled integer and the number of
 * decimal places it carries, never a float (ADR-0006, INV-08). `1.10` is 110 at scale 2, and the
 * same rate as `1.1`, because rates compare numerically (A-10).
 */
export class Rate {
  private constructor(
    readonly unscaled: bigint,
    readonly scale: number,
  ) {}

  /** A-10: at most eight decimal places, positive. The DTO refuses malformed input on HTTP;
   * the domain refuses it too, so no other caller can build a rate that cannot be stored. */
  static parse(text: string): Rate {
    if (!DECIMAL.test(text)) {
      throw new RangeError(`Rate ${text} is not a decimal of up to 8 places`);
    }
    const [whole, fraction = ''] = text.split('.');
    const unscaled = BigInt(`${whole}${fraction}`);
    if (unscaled === 0n) throw new RangeError(`Rate ${text} is not positive`);
    return new Rate(unscaled, fraction.length);
  }

  static one(): Rate {
    return new Rate(1n, 0);
  }

  isOne(): boolean {
    const canonical = this.canonical();
    return canonical.unscaled === 1n && canonical.scale === 0;
  }

  equals(other: Rate): boolean {
    return this.toString() === other.toString();
  }

  /** A-10: trailing fractional zeros dropped, no fractional part on an integer. */
  toString(): string {
    const {unscaled, scale} = this.canonical();
    if (scale === 0) return unscaled.toString();
    const digits = unscaled.toString().padStart(scale + 1, '0');
    return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  }

  private canonical(): {unscaled: bigint; scale: number} {
    let unscaled = this.unscaled;
    let scale = this.scale;
    while (scale > 0 && unscaled % TEN === 0n) {
      unscaled /= TEN;
      scale -= 1;
    }
    return {unscaled, scale};
  }
}
