import type {Prisma} from '../../../../generated/prisma/client';
import {
  TreasuryMessageRecord,
  TreasuryMessageStore,
} from '../../domain/ports/treasury-message-store';
import {ClientAccess} from './client-access';

export interface StoredTreasuryMessage extends TreasuryMessageRecord {
  readonly duplicateCount: number;
  readonly processedAt: Date;
}

export class PrismaTreasuryMessageStore implements TreasuryMessageStore {
  constructor(private readonly db: ClientAccess) {}

  async wasProcessed(messageId: string): Promise<boolean> {
    const row = await this.db.withClient((client) =>
      client.treasuryMessage.findUnique({where: {messageId}, select: {messageId: true}}),
    );
    return row !== null;
  }

  async recordOutcome(record: TreasuryMessageRecord): Promise<void> {
    await this.db.withClient((client) =>
      client.treasuryMessage.create({
        data: {
          messageId: record.messageId,
          programId: record.programId,
          type: record.type,
          payload: record.payload as Prisma.InputJsonValue,
          outcome: record.outcome,
          error: record.error,
          receivedAt: record.receivedAt,
        },
      }),
    );
  }

  async recordDuplicate(messageId: string): Promise<void> {
    await this.db.withClient((client) =>
      client.treasuryMessage.update({
        where: {messageId},
        data: {duplicateCount: {increment: 1}},
      }),
    );
  }

  async findById(messageId: string): Promise<StoredTreasuryMessage | null> {
    const row = await this.db.withClient((client) =>
      client.treasuryMessage.findUnique({where: {messageId}}),
    );
    if (row === null) return null;
    return {
      messageId: row.messageId,
      programId: row.programId,
      type: row.type,
      payload: row.payload,
      outcome: row.outcome,
      error: row.error,
      receivedAt: row.receivedAt,
      duplicateCount: row.duplicateCount,
      processedAt: row.processedAt,
    };
  }
}
