import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {AvailabilityDto} from './availability.dto';

export const toAvailabilityDto = (program: Program): AvailabilityDto => ({
  programId: program.programId,
  currency: program.currency,
  limit: jsonInteger(program.limit),
  reserved: jsonInteger(program.reserved),
  available: jsonInteger(program.available),
  overcommitted: program.overcommitted,
  asOf: program.asOf === null ? null : program.asOf.toISOString(),
});

// ADR-0006: integer JSON, exact while it fits a double. Beyond that the honest answer is a
// failure, not a rounded number.
const jsonInteger = (money: Money): number => {
  if (money.amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${money.amount} ${money.currency} does not fit a JSON integer exactly`);
  }
  return Number(money.amount);
};
