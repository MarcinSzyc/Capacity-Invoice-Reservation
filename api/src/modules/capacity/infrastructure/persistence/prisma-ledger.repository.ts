import {CapacityMovement} from '../../domain/capacity-movement';
import {LedgerRepository} from '../../domain/ports/ledger.repository';
import {ClientAccess} from './client-access';
import {toMovement, toMovementColumns} from './mappers';

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly db: ClientAccess) {}

  async append(movement: CapacityMovement): Promise<void> {
    await this.db.withClient((client) =>
      client.capacityMovement.create({data: toMovementColumns(movement)}),
    );
  }

  /** A reservation's own rows, oldest first: what AC-19 shows and what AC-16 searches. */
  async findByReservation(reservationId: string): Promise<CapacityMovement[]> {
    const rows = await this.db.withClient((client) =>
      client.capacityMovement.findMany({where: {reservationId}, orderBy: {id: 'asc'}}),
    );
    return rows.map(toMovement);
  }

  /** In the order they were appended, which is the order that explains the balances (INV-04). */
  async findByProgram(programId: string): Promise<CapacityMovement[]> {
    const rows = await this.db.withClient((client) =>
      client.capacityMovement.findMany({where: {programId}, orderBy: {id: 'asc'}}),
    );
    return rows.map(toMovement);
  }
}
