import {jsonInteger} from '../../../../common/json-integer';
import {CapacityMovement} from '../../domain/capacity-movement';
import {Reservation} from '../../domain/reservation';
import {CapacityMovementDto, ReservationDto, ReservationWithMovementsDto} from './reservation.dto';

export const toReservationDto = (reservation: Reservation): ReservationDto => {
  const described = reservation.describe();
  return {
    programId: described.programId,
    invoiceId: described.invoiceId,
    invoiceAmount: jsonInteger(described.invoiceAmount, 'invoiceAmount'),
    invoiceCurrency: described.invoiceCurrency,
    reservedAmount: jsonInteger(described.reservedAmount, 'reservedAmount'),
    held: jsonInteger(described.held, 'held'),
    releasedInvoiceAmount: jsonInteger(described.releasedInvoiceAmount, 'releasedInvoiceAmount'),
    rate: described.rate,
    status: described.status,
    source: described.source,
    createdAt: described.createdAt.toISOString(),
  };
};

/** AC-19: `amount` is the movement's signed effect on `held`, in program currency. */
const toMovementDto = (movement: CapacityMovement): CapacityMovementDto => ({
  kind: movement.kind,
  amount: jsonInteger(movement.deltaHeld, 'amount'),
  reason: movement.reason,
  releaseId: movement.releaseId,
  messageId: 'messageId' in movement.attribution ? movement.attribution.messageId : null,
  clientId: 'clientId' in movement.attribution ? movement.attribution.clientId : null,
  occurredAt: movement.occurredAt.toISOString(),
});

export const toReservationWithMovementsDto = (
  reservation: Reservation,
  movements: readonly CapacityMovement[],
): ReservationWithMovementsDto => ({
  ...toReservationDto(reservation),
  movements: movements.map(toMovementDto),
});
