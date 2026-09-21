import {Program} from '../program';

export const PROGRAM_REPOSITORY = Symbol('ProgramRepository');

export interface ProgramRepository {
  findById(programId: string): Promise<Program | null>;
  /** Reads the program and locks its row until the unit of work ends (ADR-0002, ADR-0008). */
  lockById(programId: string): Promise<Program | null>;
  save(program: Program): Promise<void>;
}
