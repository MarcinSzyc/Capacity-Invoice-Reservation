/** What became of a treasury message. `duplicate` is a count on the first record, not a row. */
export type TreasuryMessageOutcome = 'applied' | 'duplicate' | 'stale' | 'rejected';

export interface TreasuryMessageRecord {
  readonly messageId: string;
  /** Null when the message was too malformed to say which program or type it meant. */
  readonly programId: string | null;
  readonly type: string | null;
  readonly payload: unknown;
  readonly outcome: Exclude<TreasuryMessageOutcome, 'duplicate'>;
  readonly error: string | null;
  readonly receivedAt: Date;
}

/** Every consumed message leaves a trace here, which is what makes redelivery a no-op (A-13). */
export interface TreasuryMessageStore {
  wasProcessed(messageId: string): Promise<boolean>;
  recordOutcome(record: TreasuryMessageRecord): Promise<void>;
  recordDuplicate(messageId: string): Promise<void>;
}
