export const STATE_RESET = Symbol('StateReset');

/** Dev only (glossary: Dev endpoint): empties programs, reservations, the ledger and messages. */
export interface StateReset {
  resetAll(): Promise<void>;
}
