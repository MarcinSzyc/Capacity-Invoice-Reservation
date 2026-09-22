import {ReservationRepository} from '../../domain/ports/reservation.repository';
import {Reservation} from '../../domain/reservation';
import {ClientAccess} from './client-access';
import {toReservation, toReservationColumns} from './mappers';

export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly db: ClientAccess) {}

  async findByInvoice(programId: string, invoiceId: string): Promise<Reservation | null> {
    const row = await this.db.withClient((client) =>
      client.reservation.findUnique({where: {programId_invoiceId: {programId, invoiceId}}}),
    );
    return row === null ? null : toReservation(row);
  }

  async add(reservation: Reservation): Promise<void> {
    await this.db.withClient((client) =>
      client.reservation.create({data: toReservationColumns(reservation)}),
    );
  }

  async findActiveByProgram(programId: string): Promise<Reservation[]> {
    const rows = await this.db.withClient((client) =>
      client.reservation.findMany({
        where: {programId, held: {gt: 0}},
        orderBy: [{createdAt: 'asc'}, {id: 'asc'}],
      }),
    );
    return rows.map(toReservation);
  }
}
