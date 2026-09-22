import {Inject, Injectable} from '@nestjs/common';
import {
  CurrencyMismatchError,
  ProgramNotFoundError,
  ReservationAlreadyExistsError,
} from '../domain/errors';
import {Money} from '../domain/money';
import {CLOCK, Clock} from '../domain/ports/clock';
import {CapacityRepositories, UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';
import {Reservation} from '../domain/reservation';

/** A validated reservation request (A-07, A-10), typed: the controller did the parsing. */
export interface ReserveCapacityCommand {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: bigint;
  readonly invoiceCurrency: string;
  /** The token's subject, recorded on the movement (A-14, INV-09). */
  readonly clientId: string;
}

/**
 * ADR-0008: one transaction that locks the program row first, so two parallel requests on one
 * program are judged one after the other against the real state (INV-01). The duplicate check
 * runs before the capacity check so a repeated invoice on a full program is a conflict (AC-05).
 */
@Injectable()
export class ReserveCapacity {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ReserveCapacityCommand): Promise<Reservation> {
    return this.unitOfWork.run(async (repositories) => {
      const program = await repositories.programs.lockById(command.programId);
      if (program === null) throw new ProgramNotFoundError(command.programId);
      if (command.invoiceCurrency !== program.currency) {
        // Until S-04 brings the rate, a reservation is only made in the program's currency.
        throw new CurrencyMismatchError(program.currency, command.invoiceCurrency, 'Reservation');
      }

      const existing = await repositories.reservations.findByInvoice(
        command.programId,
        command.invoiceId,
      );
      if (existing !== null) throw new ReservationAlreadyExistsError(existing);

      return this.reserve(program, command, repositories);
    });
  }

  private async reserve(
    program: Program,
    command: ReserveCapacityCommand,
    {programs, reservations, ledger}: CapacityRepositories,
  ): Promise<Reservation> {
    const invoiceAmount = Money.of(command.invoiceAmount, command.invoiceCurrency);
    const reservation = Reservation.open({
      programId: command.programId,
      invoiceId: command.invoiceId,
      invoiceAmount,
      reservedAmount: Money.of(invoiceAmount.amount, program.currency),
      clientId: command.clientId,
      createdAt: this.clock.now(),
    });
    const movement = program.reserve(
      reservation.held,
      command.clientId,
      reservation.reservationId,
      reservation.createdAt,
    );

    await reservations.add(reservation);
    await ledger.append(movement);
    await programs.save(program);
    return reservation;
  }
}
