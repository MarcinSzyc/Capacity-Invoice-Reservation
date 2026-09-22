import {CapacityExceededError} from './errors';
import {Money} from './money';
import {Program} from './program';
import {SeededRandom} from './testing/seeded-random';

const USD = 'USD';
const SEQUENCES = 1_000;
const STEPS = 50;
const MAX_AMOUNT = 1_000_000_000n;
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const CLIENT = 'client-property';

const usd = (amount: bigint): Money => Money.of(amount, USD);

/** One random step: a treasury limit (zero included, A-06) or a client reservation. */
const step = (program: Program, random: SeededRandom, index: number): string => {
  const at = new Date(AT_10_00.getTime() + index * 1_000);
  if (random.next() < 0.3) {
    const limit = usd(random.bigint(MAX_AMOUNT));
    program.setLimit(limit, at, `m-${index}`);
    return `setLimit ${limit.amount}`;
  }
  const held = usd(random.bigint(MAX_AMOUNT / 4n) + 1n);
  try {
    program.reserve(held, CLIENT, `r-${index}`, at);
    return `reserve ${held.amount} ok`;
  } catch (error: unknown) {
    if (error instanceof CapacityExceededError) return `reserve ${held.amount} exceeded`;
    throw error;
  }
};

const expectedAvailable = (program: Program): bigint => {
  const gap = program.limit.amount - program.reserved.amount;
  return gap < 0n ? 0n : gap;
};

describe('Program invariants', () => {
  it('[INV-11] should keep available between 0 and limit over random sequences of reservations and limit changes', () => {
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const random = new SeededRandom(seed);
      const program = Program.announce(`PRG-${seed}`, USD);
      const trace: string[] = [];

      for (let index = 0; index < STEPS; index += 1) {
        trace.push(step(program, random, index));
        const {limit, reserved, available} = program;
        const context = `seed ${seed}, after step ${index} (${trace[index] ?? ''})`;

        expect(`${context}: available >= 0`).toBe(
          `${context}: ${available.amount >= 0n ? 'available >= 0' : 'available < 0'}`,
        );
        expect(`${context}: available <= limit`).toBe(
          `${context}: ${available.amount <= limit.amount ? 'available <= limit' : 'available > limit'}`,
        );
        expect(`${context}: available ${available.amount}`).toBe(
          `${context}: available ${expectedAvailable(program)}`,
        );
        expect(`${context}: overcommitted ${program.overcommitted}`).toBe(
          `${context}: overcommitted ${reserved.amount > limit.amount}`,
        );
      }
    }
  });
});
