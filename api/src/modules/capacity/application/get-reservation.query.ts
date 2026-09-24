import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {ReservationNotFoundError} from '../domain/errors';
import {LEDGER_REPOSITORY, LedgerRepository} from '../domain/ports/ledger.repository';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../domain/ports/reservation.repository';
import {Reservation} from '../domain/reservation';

/** AC-19: the reservation and the movements that explain how it got there. */
export interface ReservationWithMovements {
  readonly reservation: Reservation;
  readonly movements: readonly CapacityMovement[];
}

@Injectable()
export class GetReservation {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepository,
  ) {}

  async execute(programId: string, invoiceId: string): Promise<ReservationWithMovements> {
    const reservation = await this.reservations.findByInvoice(programId, invoiceId);
    if (reservation === null) throw new ReservationNotFoundError(programId, invoiceId);
    const movements = await this.ledger.findByReservation(reservation.reservationId);
    return {reservation, movements};
  }
}
