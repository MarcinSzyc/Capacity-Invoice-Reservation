import {StateReset} from '../../domain/ports/state-reset';
import {ClientAccess} from './client-access';

/** One statement, so the ledger is never seen half emptied. Row ids start again from 1. */
export class PrismaStateReset implements StateReset {
  constructor(private readonly db: ClientAccess) {}

  async resetAll(): Promise<void> {
    await this.db.withClient((client) =>
      client.$executeRawUnsafe(
        'TRUNCATE capacity_movements, reservations, programs, treasury_messages, treasury_message_failures RESTART IDENTITY',
      ),
    );
  }
}
