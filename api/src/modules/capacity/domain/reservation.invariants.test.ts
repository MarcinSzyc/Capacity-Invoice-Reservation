import {ReleaseExceedsHeldError, ReservationAlreadyReleasedError} from './errors';
import {Money} from './money';
import {Rate} from './rate';
import {Reservation} from './reservation';
import {SeededRandom} from './testing/seeded-random';

const USD = 'USD';
const EUR = 'EUR';
const SEQUENCES = 1_000;
const STEPS = 12;
const INVOICE_AMOUNT = 100_000_000n;
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const CLIENT = 'client-property';
// Rates that do not divide evenly, which is where a per-release rounding would drift (ADR-0009).
const RATES: readonly [string, ...string[]] = ['1.13', '0.0067', '3.2560', '1', '0.30712'];

const reservationAt = (rate: Rate): Reservation => {
  const invoiceAmount = Money.of(INVOICE_AMOUNT, EUR);
  return Reservation.open({
    programId: 'PRG-1',
    invoiceId: 'INV-A',
    invoiceAmount,
    reservedAmount: invoiceAmount.convert(rate, USD),
    rate,
    clientId: CLIENT,
    createdAt: AT_10_00,
  });
};

/** One random step: a release of a random slice of the invoice, sometimes more than is left. */
const step = (reservation: Reservation, random: SeededRandom, index: number): string => {
  const amount = Money.of(random.bigint(INVOICE_AMOUNT / 3n) + 1n, EUR);
  try {
    reservation.release({amount, releaseId: `R-${index}`, reason: 'repaid', clientId: CLIENT});
    return `release ${amount.amount} ok`;
  } catch (error: unknown) {
    if (error instanceof ReleaseExceedsHeldError) return `release ${amount.amount} exceeded`;
    if (error instanceof ReservationAlreadyReleasedError) return `release ${amount.amount} closed`;
    throw error;
  }
};

describe('Reservation invariants', () => {
  it('[INV-02] should keep held between 0 and reservedAmount over random release sequences', () => {
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const random = new SeededRandom(seed);
      const rate = Rate.parse(RATES[seed % RATES.length] ?? RATES[0]);
      const reservation = reservationAt(rate);
      const reservedAmount = reservation.reservedAmount;
      const history: string[] = [`rate ${rate.toString()}`];

      for (let index = 0; index < STEPS; index += 1) {
        history.push(step(reservation, random, index));
        const held = reservation.held.amount;
        const inBounds = held >= 0n && held <= reservedAmount.amount;
        const where = `seed ${seed} (${history.join(', ')})`;
        expect(`${where}: ${inBounds ? 'held in bounds' : `held ${held} out of bounds`}`).toBe(
          `${where}: held in bounds`,
        );
      }

      // Whatever the sequence left, releasing the rest closes at exactly zero (AC-12, ADR-0009).
      if (!reservation.held.isZero()) {
        reservation.release({
          amount: null,
          releaseId: 'R-last',
          reason: 'repaid',
          clientId: CLIENT,
        });
        expect(`seed ${seed}: held ${reservation.held.amount}`).toBe(`seed ${seed}: held 0`);
      }
    }
  });
});
