import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {
  ProgramNotFoundError,
  ReleaseAlreadyProcessedError,
  ReservationNotFoundError,
} from '../domain/errors';
import {Money} from '../domain/money';
import {CLOCK, Clock} from '../domain/ports/clock';
import {CapacityRepositories, UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';
import {ReleaseReason, Reservation} from '../domain/reservation';

/** A validated release request (A-08, A-09), typed: the controller did the parsing. */
export interface ReleaseCapacityCommand {
  readonly programId: string;
  readonly invoiceId: string;
  /** A-09: the client's identifier of one repayment of this invoice. */
  readonly releaseId: string;
  /** Minor units of the invoice currency; absent means everything the invoice has left (A-08). */
  readonly amount: bigint | null;
  readonly reason: ReleaseReason;
  /** The token's subject, recorded on the movement (A-14, INV-09). */
  readonly clientId: string;
}

/**
 * ADR-0008: the same one transaction behind the program row lock that `ReserveCapacity` uses, so
 * a release and a reservation on one program are judged one after the other (INV-01, INV-03).
 */
@Injectable()
export class ReleaseCapacity {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ReleaseCapacityCommand): Promise<Reservation> {
    return this.unitOfWork.run(async (repositories) => {
      const program = await repositories.programs.lockById(command.programId);
      if (program === null) throw new ProgramNotFoundError(command.programId);

      const reservation = await repositories.reservations.findByInvoice(
        command.programId,
        command.invoiceId,
      );
      if (reservation === null) {
        throw new ReservationNotFoundError(command.programId, command.invoiceId);
      }

      const movements = await repositories.ledger.findByReservation(reservation.reservationId);
      // A-09, AC-16: the repeat is answered before the amount is judged, so a retry is a
      // conflict whatever it asks for, exactly as a repeated invoice is on reserve (AC-05).
      const original = movements.find((movement) => movement.releaseId === command.releaseId);
      if (original !== undefined) throw alreadyProcessed(command.releaseId, original, movements);

      return this.release(program, reservation, command, repositories);
    });
  }

  private async release(
    program: Program,
    reservation: Reservation,
    command: ReleaseCapacityCommand,
    {programs, reservations, ledger}: CapacityRepositories,
  ): Promise<Reservation> {
    const amount =
      command.amount === null ? null : Money.of(command.amount, reservation.invoiceAmount.currency);
    const outcome = reservation.release({amount});
    const movement = program.release({
      deltaHeld: outcome.deltaHeld,
      clientId: command.clientId,
      reservationId: reservation.reservationId,
      releaseId: command.releaseId,
      reason: command.reason,
      occurredAt: this.clock.now(),
    });

    await reservations.save(reservation);
    await ledger.append(movement);
    await programs.save(program);
    return reservation;
  }
}

/**
 * The original outcome is what that release left behind: the row's own `occurredAt`, and the
 * `held` the reservation had once it and every row before it had been applied.
 */
const alreadyProcessed = (
  releaseId: string,
  original: CapacityMovement,
  movements: readonly CapacityMovement[],
): ReleaseAlreadyProcessedError => {
  const upToOriginal = movements.slice(0, movements.indexOf(original) + 1);
  const heldAfter = upToOriginal.reduce((total, row) => total + row.deltaHeld, 0n);
  return new ReleaseAlreadyProcessedError(
    releaseId,
    original.occurredAt,
    Money.of(heldAfter, original.limitAfter.currency),
  );
};
