const RETRYABLE = /ECONNRESET|ECONNREFUSED|socket hang up|EPIPE/;

const isRetryable = (error: unknown): boolean =>
  error instanceof Error && RETRYABLE.test(error.message);

/**
 * A burst of concurrent HTTP requests against a Node server occasionally has one TCP
 * connection reset by the network stack before the server ever sees it (observed on GitHub
 * Actions runners: about one in twenty-five requests in INV-01's parallel burst, well under
 * a second in). That is noise from the transport, not a signal about the invariant under
 * test, so each request gets a few attempts before the test gives up. `factory` must build a
 * fresh request on every call: a `supertest.Test` cannot be re-awaited once it has settled.
 * A non-network failure (a wrong status, a thrown assertion) is never retried.
 */
export const withConnectionResetRetry = async <T>(
  factory: () => Promise<T>,
  attemptsLeft: number = 3,
): Promise<T> => {
  try {
    return await factory();
  } catch (error) {
    if (attemptsLeft <= 1 || !isRetryable(error)) throw error;
    return withConnectionResetRetry(factory, attemptsLeft - 1);
  }
};
