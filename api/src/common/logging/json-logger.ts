import {Injectable, LoggerService} from '@nestjs/common';
import {currentCorrelationId} from './correlation-id';

type Level = 'debug' | 'verbose' | 'info' | 'warn' | 'error';

interface LogLine {
  readonly timestamp: string;
  readonly level: Level;
  readonly message: string;
  readonly context?: string;
  readonly correlationId?: string;
  readonly stack?: string;
}

@Injectable()
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: Level, message: unknown, context?: string, stack?: string): void {
    const line: LogLine = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : describe(message),
      ...(context === undefined ? {} : {context}),
      ...(stack === undefined ? {} : {stack}),
      ...withCorrelationId(),
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  }
}

const withCorrelationId = (): {correlationId?: string} => {
  const correlationId = currentCorrelationId();
  if (correlationId === undefined) return {};
  return {correlationId};
};

// Money is bigint (ADR-0001) and JSON.stringify throws on it, so a logged reservation would
// crash inside the logger. undefined stringifies to undefined, which is not a message either.
const describe = (message: unknown): string => {
  if (message === undefined) return 'undefined';
  if (message instanceof Error) return message.message;
  return JSON.stringify(message, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
};
