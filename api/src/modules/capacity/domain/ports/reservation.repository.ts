import {Reservation} from '../reservation';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');

export interface ReservationRepository {
  /** The pair (program, invoice id) is unique (A-07), so this finds at most one. */
  findByInvoice(programId: string, invoiceId: string): Promise<Reservation | null>;
  add(reservation: Reservation): Promise<void>;
  /** A release moves `held` and `releasedInvoiceAmount` on a reservation that already exists. */
  save(reservation: Reservation): Promise<void>;
}
