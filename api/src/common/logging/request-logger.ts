import type {NextFunction, Request, Response} from 'express';
import {JsonLogger} from './json-logger';

const CONTEXT = 'Http';

/**
 * A-18, AC-40: one line per request once it has been answered, under the request's correlation
 * id. Query strings are left out: they may carry identifiers we would rather not have in logs.
 */
export const requestLogger =
  (logger: JsonLogger) =>
  (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      logger.log(
        `${request.method} ${request.path} ${response.statusCode} in ${elapsedMs}ms`,
        CONTEXT,
      );
    });
    next();
  };
