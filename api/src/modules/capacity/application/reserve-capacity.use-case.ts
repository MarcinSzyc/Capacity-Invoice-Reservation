import {Inject, Injectable} from '@nestjs/common';
import {
  ProgramNotFoundError,
  RateValidationError,
  ReservationAlreadyExistsError,
} from '../domain/errors';
import {Money} from '../domain/money';
import {CLOCK, Clock} from '../domain/ports/clock';
import {CapacityRepositories, UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';
import {Rate} from '../domain/rate';
import {Reservation} from '../domain/reservation';

/** A validated reservation request (A-07, A-10), typed: the controller did the parsing. */
export interface ReserveCapacityCommand {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: bigint;
  readonly invoiceCurrency: string;
  /** A-02: absent when the client sent none; whether that is legal depends on the program. */
  readonly rate: Rate | null;
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

      const existing = await repositories.reservations.findByInvoice(
        command.programId,
        command.invoiceId,
      );
      if (existing !== null) throw new ReservationAlreadyExistsError(existing);

      return this.reserve(program, command, repositories);
    });
  }

  /**
   * AC-07: a rate is required when the currencies differ and must be one when they do not. Only
   * here can it be judged, because only here is the program's currency known; the duplicate
   * check above runs first, so a repeated invoice is a conflict whatever rate it carries (AC-05).
   */
  private rateFor(program: Program, command: ReserveCapacityCommand): Rate {
    const sameCurrency = command.invoiceCurrency === program.currency;
    if (!sameCurrency && command.rate === null) {
      throw new RateValidationError(
        'rate',
        `is required when invoiceCurrency ${command.invoiceCurrency} differs from the program currency ${program.currency}`,
      );
    }
    if (sameCurrency && command.rate !== null && !command.rate.isOne()) {
      throw new RateValidationError(
        'rate',
        `must be 1 or absent when invoiceCurrency equals the program currency ${program.currency}`,
      );
    }
    return command.rate ?? Rate.one();
  }

  private async reserve(
    program: Program,
    command: ReserveCapacityCommand,
    {programs, reservations, ledger}: CapacityRepositories,
  ): Promise<Reservation> {
    const rate = this.rateFor(program, command);
    const invoiceAmount = Money.of(command.invoiceAmount, command.invoiceCurrency);
    const reservedAmount = invoiceAmount.convert(rate, program.currency);
    if (reservedAmount.isZero()) {
      // Program.reserve refuses a zero held with a RangeError, which is a 500. The client can
      // know that this rate makes this amount vanish, so it is their error, named as one.
      throw new RateValidationError(
        'invoiceAmount',
        `converts to nothing in ${program.currency} at rate ${rate.toString()}`,
      );
    }
    const reservation = Reservation.open({
      programId: command.programId,
      invoiceId: command.invoiceId,
      invoiceAmount,
      reservedAmount,
      rate,
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
