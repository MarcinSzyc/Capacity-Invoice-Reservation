export const CLOCK = Symbol('Clock');

/** Where "now" comes from, so a use case can be tested at a chosen moment (INV-06 in S-06). */
export interface Clock {
  now(): Date;
}
