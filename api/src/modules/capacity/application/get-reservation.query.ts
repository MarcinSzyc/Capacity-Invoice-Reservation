import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {ProgramNotFoundError, ReservationNotFoundError} from '../domain/errors';
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
   * Both reads happen at one instant, not merely in one transaction: at the default isolation
   * each statement takes its own snapshot, so a release committing between them would return
   * the reservation as it was together with the movement that already changed it, and the
   * movements on the body would not sum to the `held` beside them. S-07 renders this body.
   */
  execute(programId: string, invoiceId: string): Promise<ReservationWithMovements> {
    return this.unitOfWork.readSnapshot(async ({programs, reservations, ledger}) => {
      // The same answers as a release gives, so a client does not learn a different thing from
      // the two routes: an unannounced program is PROGRAM_NOT_FOUND, as on reserve (AC-04).
      if ((await programs.findById(programId)) === null) throw new ProgramNotFoundError(programId);
      const reservation = await reservations.findByInvoice(programId, invoiceId);
      if (reservation === null) throw new ReservationNotFoundError(programId, invoiceId);
      const movements = await ledger.findByReservation(reservation.reservationId);
      return {reservation, movements};
    });
  }
}
