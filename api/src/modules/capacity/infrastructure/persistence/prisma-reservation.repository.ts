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

  /** Active: the invoice still has something left to release (AC-15, amended), a column compare. */
  async findActiveByProgram(programId: string): Promise<Reservation[]> {
    const rows = await this.db.withClient((client) =>
      client.reservation.findMany({
        where: {
          programId,
          releasedInvoiceAmount: {lt: client.reservation.fields.invoiceAmount},
        },
        orderBy: {invoiceId: 'asc'},
      }),
    );
    return rows.map(toReservation);
  }

  async findByInvoices(programId: string, invoiceIds: readonly string[]): Promise<Reservation[]> {
    if (invoiceIds.length === 0) return [];
    const rows = await this.db.withClient((client) =>
      client.reservation.findMany({
        where: {programId, invoiceId: {in: [...invoiceIds]}},
        orderBy: {invoiceId: 'asc'},
      }),
    );
    return rows.map(toReservation);
  }

  async add(reservation: Reservation): Promise<void> {
    await this.db.withClient((client) =>
      client.reservation.create({data: toReservationColumns(reservation)}),
    );
  }

  /**
   * A release moves `held` and `releasedInvoiceAmount`; a snapshot also moves the correction
   * (ADR-0012). Everything else is fixed for life.
   */
  async save(reservation: Reservation): Promise<void> {
    await this.db.withClient((client) =>
      client.reservation.update({
        where: {id: reservation.reservationId},
        data: {
          held: reservation.held.amount,
          releasedInvoiceAmount: reservation.releasedInvoiceAmount.amount,
          heldCorrection: reservation.heldCorrection,
        },
      }),
    );
  }
}
