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

  /** A release moves `held` and `releasedInvoiceAmount`; everything else is fixed for life. */
  async save(reservation: Reservation): Promise<void> {
    await this.db.withClient((client) =>
      client.reservation.update({
        where: {id: reservation.reservationId},
        data: {
          held: reservation.held.amount,
          releasedInvoiceAmount: reservation.releasedInvoiceAmount.amount,
        },
      }),
    );
  }
}
