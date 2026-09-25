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
const RATES: readonly [string, ...string[]] = [
  '1.13',
  '0.0067',
  '3.2560',
  '1',
  '0.30712',
  '0.000065',
];

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
const step = (reservation: Reservation, random: SeededRandom): string => {
  const amount = Money.of(random.bigint(INVOICE_AMOUNT / 3n) + 1n, EUR);
  try {
    reservation.release({amount});
    return `release ${amount.amount} ok`;
  } catch (error: unknown) {
    if (error instanceof ReleaseExceedsHeldError) return `release ${amount.amount} exceeded`;
    if (error instanceof ReservationAlreadyReleasedError) return `release ${amount.amount} closed`;
    throw error;
  }
};

/**
 * One random step with snapshots in the mix: a correction to a figure anywhere from nothing to
 * twice what was reserved (ADR-0012), or otherwise a release as in `step`.
 */
const mixedStep = (
  reservation: Reservation,
  random: SeededRandom,
): {entry: string; corrected: boolean; aboveReserved: boolean} => {
  const reservedAmount = reservation.reservedAmount.amount;
  if (reservation.status !== 'active' || random.next() >= 0.3) {
    return {entry: step(reservation, random), corrected: false, aboveReserved: false};
  }
  const target = random.bigint(reservedAmount * 2n);
  reservation.correctTo(Money.of(target, USD));
  return {entry: `correct ${target}`, corrected: true, aboveReserved: target > reservedAmount};
};

describe('Reservation invariants', () => {
  it('should keep held between 0 and reservedAmount over random client release sequences', () => {
    let refused = 0;
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const random = new SeededRandom(seed);
      const rate = Rate.parse(RATES[seed % RATES.length] ?? RATES[0]);
      const reservation = reservationAt(rate);
      const reservedAmount = reservation.reservedAmount;
      const history: string[] = [`rate ${rate.toString()}`];

      for (let index = 0; index < STEPS; index += 1) {
        const outcome = step(reservation, random);
        history.push(outcome);
        refused += outcome.endsWith('exceeded') || outcome.endsWith('closed') ? 1 : 0;
        const held = reservation.held.amount;
        const inBounds = held >= 0n && held <= reservedAmount.amount;
        const where = `seed ${seed} (${history.join(', ')})`;
        expect(`${where}: ${inBounds ? 'held in bounds' : `held ${held} out of bounds`}`).toBe(
          `${where}: held in bounds`,
        );
      }

      // Whatever the sequence left, releasing the rest closes at exactly zero (AC-12, ADR-0009).
      // Guarded on what the invoice has left, not on `held`: a remainder can round `held` to
      // zero while the invoice still owes, and that is exactly the case worth closing (AC-15).
      if (!reservation.remainingInvoiceAmount.isZero()) {
        reservation.release({
          amount: null,
        });
        expect(`seed ${seed}: held ${reservation.held.amount}`).toBe(`seed ${seed}: held 0`);
      }
    }

    // The sequences are meant to reach the boundary, not only to stay inside it. Without this
    // the test would still pass if the random amounts stopped ever asking for too much.
    expect(refused > 0 ? 'boundary reached' : 'boundary never reached').toBe('boundary reached');
  });

  it('[INV-02] should keep held at or above zero and never let a release raise it, with snapshot corrections among the releases', () => {
    let corrections = 0;
    let raisedAboveReserved = 0;
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const random = new SeededRandom(seed);
      const rate = Rate.parse(RATES[seed % RATES.length] ?? RATES[0]);
      const reservation = reservationAt(rate);
      const history: string[] = [`rate ${rate.toString()}`];

      for (let index = 0; index < STEPS; index += 1) {
        const heldBefore = reservation.held.amount;
        const outcome = mixedStep(reservation, random);
        history.push(outcome.entry);
        corrections += outcome.corrected ? 1 : 0;
        raisedAboveReserved += outcome.aboveReserved ? 1 : 0;
        const held = reservation.held.amount;
        const where = `seed ${seed} (${history.join(', ')})`;
        expect(`${where}: ${held >= 0n ? 'held not negative' : `held ${held}`}`).toBe(
          `${where}: held not negative`,
        );
        const raised = !outcome.corrected && held > heldBefore;
        expect(
          `${where}: ${raised ? `release raised held to ${held}` : 'no release raised held'}`,
        ).toBe(`${where}: no release raised held`);
      }
    }

    expect(
      corrections > 0 && raisedAboveReserved > 0 ? 'both reached' : 'a case never reached',
    ).toBe('both reached');
  });
});
