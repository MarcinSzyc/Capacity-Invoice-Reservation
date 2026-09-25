import {ProgramNotFoundError} from '../domain/errors';
import {Money} from '../domain/money';
import {Program} from '../domain/program';
import {ListProgramMovements} from './list-program-movements.query';
import {inMemoryCapacity} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const AT_10_00 = new Date('2026-09-21T10:00:00Z');
const AT_11_00 = new Date('2026-09-21T11:00:00Z');

describe('ListProgramMovements', () => {
  it('should return the program with its latest movements, newest first', async () => {
    const capacity = inMemoryCapacity();
    const program = Program.announce(PROGRAM_ID, USD);
    const movements = [AT_10_00, AT_11_00].map((at, index) => {
      const outcome = program.setLimit(Money.of(BigInt(index + 1), USD), at, `m-${index}`);
      if (outcome.kind !== 'applied') throw new Error('expected every limit to apply');
      return outcome.movement;
    });
    await capacity.repositories.programs.save(program);
    await capacity.repositories.ledger.appendAll(movements);

    const listed = await new ListProgramMovements(capacity).execute(PROGRAM_ID);

    expect(listed.program).toBe(program);
    expect(listed.movements).toEqual([movements[1], movements[0]]);
  });

  it('should throw PROGRAM_NOT_FOUND for a program the treasury never announced', async () => {
    await expect(new ListProgramMovements(inMemoryCapacity()).execute('PRG-x')).rejects.toThrow(
      ProgramNotFoundError,
    );
  });
});
