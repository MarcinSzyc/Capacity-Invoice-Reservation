import {Prisma as PrismaRuntime} from '../../../../generated/prisma/client';
import type {
  CapacityMovement as CapacityMovementRow,
  Prisma,
  Program as ProgramRow,
  Reservation as ReservationRow,
} from '../../../../generated/prisma/client';
import {CapacityMovement, MovementAttribution} from '../../domain/capacity-movement';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {Rate} from '../../domain/rate';
import {Reservation} from '../../domain/reservation';

type ProgramColumns = Omit<ProgramRow, 'updatedAt'>;

export const toProgram = (row: ProgramColumns): Program =>
  Program.rehydrate({
    programId: row.programId,
    currency: row.currency,
    limit: Money.of(row.creditLimit, row.currency),
    reserved: Money.of(row.reserved, row.currency),
    limitEventTime: row.limitEventTime,
    asOf: row.asOf,
  });

export const toProgramColumns = (program: Program): ProgramColumns => ({
  programId: program.programId,
  currency: program.currency,
  creditLimit: program.limit.amount,
  reserved: program.reserved.amount,
  limitEventTime: program.limitEventTime,
  asOf: program.asOf,
});

export const toMovementColumns = (
  movement: CapacityMovement,
): Prisma.CapacityMovementUncheckedCreateInput => ({
  programId: movement.programId,
  reservationId: movement.reservationId,
  kind: movement.kind,
  currency: movement.limitAfter.currency,
  deltaHeld: movement.deltaHeld.amount,
  limitAfter: movement.limitAfter.amount,
  reservedAfter: movement.reservedAfter.amount,
  availableAfter: movement.availableAfter.amount,
  clientId: 'clientId' in movement.attribution ? movement.attribution.clientId : null,
  messageId: 'messageId' in movement.attribution ? movement.attribution.messageId : null,
  releaseId: null,
  reason: null,
  occurredAt: movement.occurredAt,
});

export const toMovement = (row: CapacityMovementRow): CapacityMovement => ({
  kind: row.kind,
  programId: row.programId,
  reservationId: row.reservationId,
  deltaHeld: Money.of(row.deltaHeld, row.currency),
  limitAfter: Money.of(row.limitAfter, row.currency),
  reservedAfter: Money.of(row.reservedAfter, row.currency),
  availableAfter: Money.of(row.availableAfter, row.currency),
  attribution: attributionOf(row),
  occurredAt: row.occurredAt,
});

// The CHECK constraint on the table guarantees one of the two is set (INV-09).
const attributionOf = (row: CapacityMovementRow): MovementAttribution => {
  if (row.clientId !== null) return {clientId: row.clientId};
  if (row.messageId !== null) return {messageId: row.messageId};
  throw new Error(`Ledger row ${row.id} names neither a client nor a message`);
};

type ReservationColumns = Omit<ReservationRow, 'updatedAt'>;

export const toReservation = (row: ReservationColumns): Reservation =>
  Reservation.rehydrate({
    reservationId: row.id,
    programId: row.programId,
    invoiceId: row.invoiceId,
    invoiceAmount: Money.of(row.invoiceAmount, row.invoiceCurrency),
    reservedAmount: Money.of(row.reservedAmount, row.currency),
    held: Money.of(row.held, row.currency),
    // toFixed, not toString: decimal.js renders anything below 1e-7 in exponential form, and
    // the contract allows eight places, so `0.00000001` would come back as `1e-8` and be
    // unreadable by `Rate` on every later read of the row.
    rate: Rate.parse(row.rate.toFixed()),
    source: row.source,
    clientId: row.clientId,
    createdAt: row.createdAt,
  });

export const toReservationColumns = (reservation: Reservation): ReservationColumns => ({
  id: reservation.reservationId,
  programId: reservation.programId,
  invoiceId: reservation.invoiceId,
  invoiceAmount: reservation.invoiceAmount.amount,
  invoiceCurrency: reservation.invoiceAmount.currency,
  currency: reservation.reservedAmount.currency,
  reservedAmount: reservation.reservedAmount.amount,
  held: reservation.held.amount,
  rate: new PrismaRuntime.Decimal(reservation.rate.toString()),
  source: reservation.source,
  clientId: reservation.clientId,
  createdAt: reservation.createdAt,
});
