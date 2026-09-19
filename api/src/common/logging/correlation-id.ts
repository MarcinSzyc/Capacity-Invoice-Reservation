import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const storage = new AsyncLocalStorage<string>();

export const currentCorrelationId = (): string | undefined => storage.getStore();

export const runWithCorrelationId = <T>(correlationId: string, work: () => T): T =>
  storage.run(correlationId, work);

/**
 * A18: every log line of one request carries the same id, so a reviewer can follow a request
 * across layers. An id sent by the caller wins, so the id spans our service and theirs.
 */
export const correlationIdMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const incoming = request.header(CORRELATION_ID_HEADER)?.trim();
  const correlationId = incoming !== undefined && incoming !== '' ? incoming : randomUUID();
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  runWithCorrelationId(correlationId, next);
};
