/**
 * A rejected message is recorded under whatever of its ids can still be read, and "readable"
 * includes "fits the column": an id that does not would fail the insert, roll back, leave the
 * offset uncommitted and stall the partition (A-13, AC-25).
 */
export const readableString = (
  payload: unknown,
  field: string,
  maxLength: number,
): string | null => {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const value: unknown = (payload as Record<string, unknown>)[field];
  if (typeof value !== 'string' || value === '' || value.length > maxLength) return null;
  return value;
};
