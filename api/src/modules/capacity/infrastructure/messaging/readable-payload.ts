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
 * A snapshot at its 10 000 entry bound is about 1.5 MB of JSON. The bound is far above that and
 * far below what jsonb holds (256 MiB for one string), so a legal message is always kept and a
 * pathological one never reaches the database (review round 4 of S-08).
 */
export const STORED_PAYLOAD_MAX_BYTES = 16_000_000;

/**
 * The payload as it can be kept on the record, or null when it cannot: nested past the bound,
 * larger than the bound, or carrying a string or a key PostgreSQL refuses in jsonb
 * (`isStorableText`). A record that cannot be written stalls the partition (A-13 clause 4); the
 * dead letter keeps the bytes (ADR-0003). The walk is iterative, so it cannot overflow on the
 * input it guards against, and it stops as soon as the size is past the bound.
 */
export const storablePayload = (payload: unknown): unknown => {
  const pending: {value: unknown; depth: number}[] = [{value: payload, depth: 0}];
  let bytes = 0;
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const {value, depth} = next;
    bytes += approximateBytes(value);
    if (bytes > STORED_PAYLOAD_MAX_BYTES) return null;
    if (typeof value === 'string' && !isStorableText(value)) return null;
    if (typeof value !== 'object' || value === null) continue;
    if (depth >= STORED_PAYLOAD_MAX_DEPTH) return null;
    const entries: [string, unknown][] = Object.entries(value);
    if (entries.some(([key]) => !isStorableText(key))) return null;
    // One push per child: spreading a wide array into one call overflows the stack.
    for (const [key, child] of entries) {
      bytes += Buffer.byteLength(key, 'utf8');
      pending.push({value: child, depth: depth + 1});
    }
  }
  return payload;
};

// Numbers, booleans and null are small; a string counts its UTF-8 bytes. Close enough for a
// bound that sits two orders of magnitude from either side.
const SCALAR_BYTES = 8;
const approximateBytes = (value: unknown): number =>
  typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : SCALAR_BYTES;

/**
 * A validation error names every field it refuses, so it grows with the message; unbounded, its
 * header alone could make the dead letter larger than the broker accepts (review round 2 of
 * S-08). The value has its own bound, `DEAD_LETTER_VALUE_MAX_BYTES`. Enough to read what went
 * wrong.
 */
export const ERROR_TEXT_MAX_LENGTH = 2_000;

/**
 * An error text can quote the input it refused, so it is made storable rather than refused. Cut
 * before `toWellFormed`, so a surrogate pair split by the cut becomes a replacement character.
 */
export const storableText = (text: string): string =>
  text.slice(0, ERROR_TEXT_MAX_LENGTH).replaceAll(NUL, '').toWellFormed();
