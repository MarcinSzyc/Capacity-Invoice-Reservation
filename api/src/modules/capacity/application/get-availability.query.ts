import {Inject, Injectable} from '@nestjs/common';
import {ProgramNotFoundError} from '../domain/errors';
import {PROGRAM_REPOSITORY, ProgramRepository} from '../domain/ports/program.repository';
import {Program} from '../domain/program';

@Injectable()
export class GetAvailability {
  constructor(@Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository) {}

  async execute(programId: string): Promise<Program> {
    const program = await this.programs.findById(programId);
    if (program === null) throw new ProgramNotFoundError(programId);
    return program;
  }
}
