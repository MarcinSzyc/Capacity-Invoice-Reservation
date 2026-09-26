import {ValidateBy} from 'class-validator';
import {isStorableText} from './readable-payload';

/**
 * PostgreSQL refuses NUL and lone surrogates in a text column, so such an id could never be
 * stored. Refused on sight as malformed (A-13 clause 4) rather than after three failed attempts.
 */
export const StorableId = (): PropertyDecorator =>
  ValidateBy({
    name: 'storableId',
    validator: {
      validate: (value: unknown) => typeof value !== 'string' || isStorableText(value),
      defaultMessage: (args) =>
        `${args?.property ?? 'value'} must be text PostgreSQL can store: no NUL, well-formed Unicode`,
    },
  });
