import {jsonInteger} from '../../../../common/json-integer';
import {Reservation} from '../../domain/reservation';
import {ReservationDto} from './reservation.dto';

export const toReservationDto = (reservation: Reservation): ReservationDto => {
  const described = reservation.describe();
  return {
    programId: described.programId,
    invoiceId: described.invoiceId,
    invoiceAmount: jsonInteger(described.invoiceAmount, 'invoiceAmount'),
    invoiceCurrency: described.invoiceCurrency,
    reservedAmount: jsonInteger(described.reservedAmount, 'reservedAmount'),
    held: jsonInteger(described.held, 'held'),
    rate: described.rate,
    status: described.status,
    source: described.source,
    createdAt: described.createdAt.toISOString(),
  };
};
