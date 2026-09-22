import {applyDecorators} from '@nestjs/common';
import {Transform, TransformFnParams} from 'class-transformer';
import {IsISO4217CurrencyCode} from 'class-validator';

/**
 * A-10: one casing rule for every boundary. The code is uppercased before it is validated and
 * before the domain sees it, so `usd` and `USD` name the same currency whether a client sent it
 * over HTTP or the treasury over Kafka. Each edge validating on its own is what hurt: the library
 * validator uppercases before it compares, so a program announced as `usd` answered
 * `CURRENCY_MISMATCH` to every correct `USD` reservation and could never be used.
 */
export const IsCurrencyCode = (): PropertyDecorator =>
  applyDecorators(
    Transform((params: TransformFnParams) => {
      const value: unknown = params.value;
      return typeof value === 'string' ? value.toUpperCase() : value;
    }),
    IsISO4217CurrencyCode(),
  );
