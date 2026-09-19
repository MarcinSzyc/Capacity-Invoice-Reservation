import {ArgumentsHost, Catch, ExceptionFilter} from '@nestjs/common';
import type {Response} from 'express';
import {JsonLogger} from '../logging/json-logger';
import {SERVER_ERROR_FROM, toErrorBody} from './error-body';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    if (body.statusCode >= SERVER_ERROR_FROM) this.logFailure(exception);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }

  private logFailure(exception: unknown): void {
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(error.message, error.stack, 'AllExceptionsFilter');
  }
}
