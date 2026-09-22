/**
 * ADR-0006: integer JSON on the wire, exact only while it fits a double. Beyond that the honest
 * answer is a failure, not a rounded number. One rule for the API and for the dev producer.
 */
export const jsonInteger = (amount: bigint, what: string): number => {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${what} ${amount} does not fit a JSON integer exactly`);
  }
  return Number(amount);
};
