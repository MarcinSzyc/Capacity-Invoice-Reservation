import {ProgramNotFoundError} from '../domain/errors';
import {Money} from '../domain/money';
import {Program} from '../domain/program';
import {GetAvailability} from './get-availability.query';
import {InMemoryPrograms} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';

describe('GetAvailability', () => {
  it('should return the program the treasury announced', async () => {
    const programs = new InMemoryPrograms();
    const program = Program.announce(PROGRAM_ID, USD);
    program.setLimit(Money.of(1_000_000_000n, USD), new Date('2026-09-21T10:00:00Z'), 'm-1');
    await programs.save(program);

    await expect(new GetAvailability(programs).execute(PROGRAM_ID)).resolves.toBe(program);
  });

  it('should throw PROGRAM_NOT_FOUND for a program the treasury never announced', async () => {
    const query = new GetAvailability(new InMemoryPrograms());

    await expect(query.execute('PRG-unknown')).rejects.toThrow(ProgramNotFoundError);
  });
});
