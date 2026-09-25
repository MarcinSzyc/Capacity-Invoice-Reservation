import {Inject, Injectable} from '@nestjs/common';
import {CapacityMovement} from '../domain/capacity-movement';
import {ProgramNotFoundError} from '../domain/errors';
import {UNIT_OF_WORK, UnitOfWork} from '../domain/ports/unit-of-work';
import {Program} from '../domain/program';

/** The live ledger shows this many rows; older ones stay in the database (AC-38). */
export const LATEST_MOVEMENTS = 100;

export interface ProgramMovements {
  readonly program: Program;
  readonly movements: readonly CapacityMovement[];
}

/** The demo page's live ledger: the program and its latest rows, read at one instant. */
@Injectable()
export class ListProgramMovements {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(programId: string): Promise<ProgramMovements> {
    return this.unitOfWork.readSnapshot(async ({programs, ledger}) => {
      const program = await programs.findById(programId);
      if (program === null) throw new ProgramNotFoundError(programId);
      return {program, movements: await ledger.findLatestByProgram(programId, LATEST_MOVEMENTS)};
    });
  }
}
