import {Reservation} from '../reservation';

export interface ReservationRepository {
  /** The pair (program, invoice id) is unique (A-07), so this finds at most one. */
  findByInvoice(programId: string, invoiceId: string): Promise<Reservation | null>;
  add(reservation: Reservation): Promise<void>;
}
