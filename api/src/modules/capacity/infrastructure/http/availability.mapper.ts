import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {jsonInteger} from '../json-integer';
import {AvailabilityDto} from './availability.dto';

export const toAvailabilityDto = (program: Program): AvailabilityDto => ({
  programId: program.programId,
  currency: program.currency,
  limit: minorUnits(program.limit, 'limit'),
  reserved: minorUnits(program.reserved, 'reserved'),
  available: minorUnits(program.available, 'available'),
  overcommitted: program.overcommitted,
  asOf: program.asOf === null ? null : program.asOf.toISOString(),
});

const minorUnits = (money: Money, field: string): number => jsonInteger(money.amount, field);
