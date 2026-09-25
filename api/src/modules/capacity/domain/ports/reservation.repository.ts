import {Reservation} from '../reservation';

export interface ReservationRepository {
  /** The pair (program, invoice id) is unique (A-07), so this finds at most one. */
  findByInvoice(programId: string, invoiceId: string): Promise<Reservation | null>;
  /**
   * A-12: the reservations a snapshot has to account for, listed or not. Active means the invoice
   * still has something left to release (AC-15, amended), not that `held` is above zero.
   */
  findActiveByProgram(programId: string): Promise<Reservation[]>;
  /** The listed invoices of a snapshot that we know, whatever their status (ADR-0012, 3A). */
  findByInvoices(programId: string, invoiceIds: readonly string[]): Promise<Reservation[]>;
  add(reservation: Reservation): Promise<void>;
  /** A release moves `held` and `releasedInvoiceAmount` on a reservation that already exists. */
  save(reservation: Reservation): Promise<void>;
}
