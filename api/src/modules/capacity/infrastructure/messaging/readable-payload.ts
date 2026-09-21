/**
 * Column widths of the message store. A rejected message is recorded under whatever of its ids
 * can still be read, and "readable" includes "fits the column": an id that does not would fail
 * the insert, roll back, leave the offset uncommitted and stall the partition (A-13, AC-25).
 */
export const MESSAGE_ID_MAX_LENGTH = 128;
export const PROGRAM_ID_MAX_LENGTH = 64;
export const MESSAGE_TYPE_MAX_LENGTH = 32;

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
