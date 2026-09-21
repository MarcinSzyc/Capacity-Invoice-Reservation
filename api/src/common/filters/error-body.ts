import {HttpException, HttpStatus} from '@nestjs/common';
import {DomainError, DomainErrorKind} from '../errors/domain-error';

export interface ErrorBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly string[];
  /** Business fields next to the code, such as `available` on CAPACITY_EXCEEDED (AC-03). */
  readonly [field: string]: unknown;
}

export const SERVER_ERROR_FROM = 500;
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
};

// The one place a domain error kind becomes an HTTP status (CLAUDE.md §2).
const STATUS_BY_KIND: Readonly<Record<DomainErrorKind, number>> = {
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  unprocessable: HttpStatus.UNPROCESSABLE_ENTITY,
};

/**
 * One shape for every error the service returns (CLAUDE.md §2). A 5xx says nothing beyond its
 * code: what went wrong internally is for the logs, not for the caller.
 */
export const toErrorBody = (exception: unknown): ErrorBody => {
  if (exception instanceof DomainError) {
    return {
      statusCode: STATUS_BY_KIND[exception.kind],
      code: exception.code,
      message: exception.message,
      ...exception.details,
    };
  }
  if (!(exception instanceof HttpException)) return internalError();

  const statusCode = exception.getStatus();
  if (statusCode >= SERVER_ERROR_FROM) return internalError(statusCode);

  const payload = exception.getResponse();
  const details = validationDetails(payload);
  if (details !== undefined) {
    return {
      statusCode,
      code: VALIDATION_FAILED_CODE,
      message: 'Request validation failed',
      details,
    };
  }
  return {statusCode, code: codeOf(payload, statusCode), message: messageOf(payload, exception)};
};

const internalError = (statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR): ErrorBody => ({
  statusCode,
  code: INTERNAL_ERROR_CODE,
  message: 'Internal server error',
});

const asRecord = (payload: unknown): Record<string, unknown> | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return payload as Record<string, unknown>;
};

const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const validationDetails = (payload: unknown): readonly string[] | undefined => {
  const message = asRecord(payload)?.message;
  if (!isUnknownArray(message)) return undefined;
  return message.map((entry) => String(entry));
};

const codeOf = (payload: unknown, statusCode: number): string => {
  const code = asRecord(payload)?.code;
  if (typeof code === 'string') return code;
  return CODE_BY_STATUS[statusCode] ?? 'HTTP_ERROR';
};

const messageOf = (payload: unknown, exception: HttpException): string => {
  if (typeof payload === 'string') return payload;
  const message = asRecord(payload)?.message;
  if (typeof message === 'string') return message;
  return exception.message;
};
