import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {jsonInteger} from '../json-integer';
import {AvailabilityDto} from './availability.dto';

export const toAvailabilityDto = (program: Program): AvailabilityDto => ({
  programId: program.programId,
  currency: program.currency,
  limit: minorUnits(program.limit),
  reserved: minorUnits(program.reserved),
  available: minorUnits(program.available),
  overcommitted: program.overcommitted,
  asOf: program.asOf === null ? null : program.asOf.toISOString(),
});

const minorUnits = (money: Money): number => jsonInteger(money.amount, money.currency);
