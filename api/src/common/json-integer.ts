const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * ADR-0006: integer JSON on the wire, exact only while it fits a double. Beyond that the honest
 * answer is a failure, not a rounded number. One rule for the API and for the dev producer.
 * Magnitude, not value: a ledger delta is signed (a release lowers `held`), and a number too
 * large to be exact is just as wrong with a minus in front of it.
 */
export const jsonInteger = (amount: bigint, what: string): number => {
  if (amount > SAFE || amount < -SAFE) {
    throw new RangeError(`${what} ${amount} does not fit a JSON integer exactly`);
  }
  return Number(amount);
};
