import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {ReservationNotFoundError} from '../domain/errors';
import {UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Reservation} from '../domain/reservation';

/** AC-19: the reservation and the movements that explain how it got there. */
export interface ReservationWithMovements {
  readonly reservation: Reservation;
  readonly movements: readonly CapacityMovement[];
}

@Injectable()
export class GetReservation {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  /**
   * Both reads happen in one transaction. Apart they can disagree: a release committing between
   * them would return the reservation as it was together with the movement that already changed
   * it, so the movements on the body would not sum to the `held` beside them. That is the same
   * rule the ledger invariant helper states for its own reads, and S-07 renders this body.
   */
  execute(programId: string, invoiceId: string): Promise<ReservationWithMovements> {
    return this.unitOfWork.run(async ({reservations, ledger}) => {
      const reservation = await reservations.findByInvoice(programId, invoiceId);
      if (reservation === null) throw new ReservationNotFoundError(programId, invoiceId);
      const movements = await ledger.findByReservation(reservation.reservationId);
      return {reservation, movements};
    });
  }
}
