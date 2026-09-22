const RETRYABLE = /ECONNRESET|ECONNREFUSED|socket hang up|EPIPE/;
const BACKOFF_MS = 300;

const isRetryable = (error: unknown): boolean =>
  error instanceof Error && RETRYABLE.test(error.message);

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A burst of concurrent HTTP requests against a Node server occasionally has a TCP connection
 * reset by the network stack before the server ever sees it (observed on GitHub Actions
 * runners in INV-01's 25-request burst). An immediate retry lands back in the same saturated
 * moment and fails the same way, which is what a first version of this helper (no delay) did:
 * it still failed on the third attempt. This version waits `BACKOFF_MS` past what the burst
 * itself takes to drain before trying again, so the retry runs outside the saturated window
 * rather than inside it. A non-network failure (a wrong status, a thrown assertion) is never
 * retried. `factory` must build a fresh request on every call: a `supertest.Test` cannot be
 * re-awaited once it has settled.
 */
export const withConnectionResetRetry = async <T>(
  factory: () => Promise<T>,
  attemptsLeft: number = 3,
): Promise<T> => {
  try {
    return await factory();
  } catch (error) {
    if (attemptsLeft <= 1 || !isRetryable(error)) throw error;
    await delay(BACKOFF_MS);
    return withConnectionResetRetry(factory, attemptsLeft - 1);
  }
};
