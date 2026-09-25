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

  /** One multi-row INSERT: its rows take their ids in the order of the list, so they chain. */
  async appendAll(movements: readonly CapacityMovement[]): Promise<void> {
    if (movements.length === 0) return;
    await this.db.withClient((client) =>
      client.capacityMovement.createMany({data: movements.map(toMovementColumns)}),
    );
  }

  /** A reservation's own rows, oldest first: what AC-19 shows and what AC-16 searches. */
  async findByReservation(reservationId: string): Promise<CapacityMovement[]> {
    const rows = await this.db.withClient((client) =>
      client.capacityMovement.findMany({where: {reservationId}, orderBy: {id: 'asc'}}),
    );
    return rows.map(toMovement);
  }

  /**
   * The latest row of each reservation, in one read. Prisma's `distinct` without the
   * `nativeDistinct` preview is not `DISTINCT ON`: it selects every row of these reservations,
   * ordered, and keeps the first of each in memory. One round trip, but not one row each.
   */
  async findLastByReservations(
    reservationIds: readonly string[],
  ): Promise<Map<string, CapacityMovement>> {
    if (reservationIds.length === 0) return new Map();
    const rows = await this.db.withClient((client) =>
      client.capacityMovement.findMany({
        where: {reservationId: {in: [...reservationIds]}},
        orderBy: [{reservationId: 'asc'}, {id: 'desc'}],
        distinct: ['reservationId'],
      }),
    );
    return new Map(rows.map((row) => [row.reservationId ?? '', toMovement(row)]));
  }

  /** ADR-0012, 2A: what clients did after a snapshot's moment, in the order it was appended. */
  async findClientMovementsSince(programId: string, since: Date): Promise<CapacityMovement[]> {
    const rows = await this.db.withClient((client) =>
      client.capacityMovement.findMany({
        where: {programId, kind: {in: ['reserve', 'release']}, occurredAt: {gt: since}},
        orderBy: {id: 'asc'},
      }),
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
