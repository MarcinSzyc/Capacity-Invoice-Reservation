import type {Program as ProgramRow} from '../../../../generated/prisma/client';
import {ProgramRepository} from '../../domain/ports/program.repository';
import {Program} from '../../domain/program';
import {ClientAccess} from './client-access';
import {toProgram, toProgramColumns} from './mappers';

type LockedRow = {
  program_id: string;
  currency: string;
  credit_limit: bigint;
  reserved: bigint;
  limit_event_time: Date | null;
  as_of: Date | null;
};

export class PrismaProgramRepository implements ProgramRepository {
  constructor(private readonly db: ClientAccess) {}

  async findById(programId: string): Promise<Program | null> {
    const row = await this.db.withClient((client) =>
      client.program.findUnique({where: {programId}}),
    );
    return row === null ? null : toProgram(row);
  }

  /**
   * ADR-0002: the row lock is one raw statement. It serialises every writer of one program for
   * the rest of the transaction, which is what keeps INV-01 true under parallel requests.
   */
  async lockById(programId: string): Promise<Program | null> {
    const rows = await this.db.withClient(
      (client) => client.$queryRaw<LockedRow[]>`
        SELECT program_id, currency, credit_limit, reserved, limit_event_time, as_of
        FROM programs
        WHERE program_id = ${programId}
        FOR UPDATE`,
    );
    const row = rows[0];
    return row === undefined ? null : toProgram(fromLockedRow(row));
  }

  async save(program: Program): Promise<void> {
    const columns = toProgramColumns(program);
    await this.db.withClient((client) =>
      client.program.upsert({
        where: {programId: program.programId},
        create: columns,
        update: columns,
      }),
    );
  }
}

const fromLockedRow = (row: LockedRow): Omit<ProgramRow, 'updatedAt'> => ({
  programId: row.program_id,
  currency: row.currency,
  creditLimit: row.credit_limit,
  reserved: row.reserved,
  limitEventTime: row.limit_event_time,
  asOf: row.as_of,
});
