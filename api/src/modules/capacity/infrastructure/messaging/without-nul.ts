import {ValidateBy} from 'class-validator';

const NUL = '\u0000';

/**
 * PostgreSQL refuses NUL in a text column, so an id carrying one could never be stored. Refused
 * on sight as malformed (A-13 clause 4) rather than after three failed attempts to apply it.
 */
export const WithoutNul = (): PropertyDecorator =>
  ValidateBy({
    name: 'withoutNul',
    validator: {
      validate: (value: unknown) => typeof value !== 'string' || !value.includes(NUL),
      defaultMessage: (args) => `${args?.property ?? 'value'} must not contain NUL`,
    },
  });
