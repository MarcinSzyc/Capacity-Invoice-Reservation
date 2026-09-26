const NUL = '\u0000';

/**
 * What PostgreSQL can hold in a text or jsonb value: no NUL, and well-formed Unicode (a lone
 * UTF-16 surrogate such as `"\ud800"` is valid JSON and refused by jsonb).
 */
export const isStorableText = (text: string): boolean => !text.includes(NUL) && text.isWellFormed();

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
  if (!isStorableText(value)) return null;
  return value;
};

/**
 * A legal message nests three levels. The bound is ours and far below any stack limit, so what
 * the store accepts does not depend on how deep Prisma's serialiser or the call stack can go
 * (S-08 local decision 2).
 */
export const STORED_PAYLOAD_MAX_DEPTH = 32;

/**
 * The payload as it can be kept on the record, or null when it cannot: nested past the bound, or
 * carrying a string or a key PostgreSQL refuses in jsonb (`isStorableText`). A record that cannot be
 * written stalls the partition (A-13 clause 4); the dead letter keeps the bytes (ADR-0003). The
 * walk is iterative, so it cannot overflow on the input it guards against.
 */
export const storablePayload = (payload: unknown): unknown => {
  const pending: {value: unknown; depth: number}[] = [{value: payload, depth: 0}];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const {value, depth} = next;
    if (typeof value === 'string' && !isStorableText(value)) return null;
    if (typeof value !== 'object' || value === null) continue;
    if (depth >= STORED_PAYLOAD_MAX_DEPTH) return null;
    const entries: [string, unknown][] = Object.entries(value);
    if (entries.some(([key]) => !isStorableText(key))) return null;
    // One push per child: spreading a wide array into one call overflows the stack.
    for (const [, child] of entries) pending.push({value: child, depth: depth + 1});
  }
  return payload;
};

/**
 * A validation error names every field it refuses, so it grows with the message; unbounded it
 * can make the dead letter larger than the broker accepts, which stalls the partition as surely
 * as a record the database refuses (review round 2 of S-08). Enough to read what went wrong.
 */
export const ERROR_TEXT_MAX_LENGTH = 2_000;

/**
 * An error text can quote the input it refused, so it is made storable rather than refused. Cut
 * before `toWellFormed`, so a surrogate pair split by the cut becomes a replacement character.
 */
export const storableText = (text: string): string =>
  text.slice(0, ERROR_TEXT_MAX_LENGTH).replaceAll(NUL, '').toWellFormed();
