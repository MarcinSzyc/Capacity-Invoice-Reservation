import {jsonInteger} from '../../../../common/json-integer';
import {ProgramMovements} from '../../application/list-program-movements.query';
import {ProgramMovementsDto} from './dev.dto';
import {toMovementDto} from './reservation.mapper';

export const toProgramMovementsDto = ({
  program,
  movements,
}: ProgramMovements): ProgramMovementsDto => ({
  programId: program.programId,
  currency: program.currency,
  movements: movements.map((movement) => ({
    ...toMovementDto(movement),
    limitAfter: jsonInteger(movement.limitAfter.amount, 'limitAfter'),
    reservedAfter: jsonInteger(movement.reservedAfter.amount, 'reservedAfter'),
    availableAfter: jsonInteger(movement.availableAfter.amount, 'availableAfter'),
  })),
});
