import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// The caller's id is echoed and repeated on every log line of the request, so it is length
// bounded: a caller does not get to decide how big our log lines are.
export const CORRELATION_ID_MAX_LENGTH = 128;

const storage = new AsyncLocalStorage<string>();

export const currentCorrelationId = (): string | undefined => storage.getStore();

export const runWithCorrelationId = <T>(correlationId: string, work: () => T): T =>
  storage.run(correlationId, work);

/**
 * For log lines a library writes on its own schedule, such as a broker reconnecting: they would
 * otherwise inherit the id of whatever request or message started the async chain they run in.
 */
export const withoutCorrelationId = <T>(work: () => T): T => storage.exit(work);

/**
 * A-18: every log line of one request carries the same id, so a reviewer can follow a request
 * across layers. An id sent by the caller wins, so the id spans our service and theirs.
 */
export const correlationIdMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const incoming = request
    .header(CORRELATION_ID_HEADER)
    ?.trim()
    .slice(0, CORRELATION_ID_MAX_LENGTH);
  const correlationId = incoming !== undefined && incoming !== '' ? incoming : randomUUID();
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  runWithCorrelationId(correlationId, next);
};
