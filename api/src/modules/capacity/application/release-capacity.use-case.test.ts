import {
  ProgramNotFoundError,
  ReleaseAlreadyProcessedError,
  ReleaseExceedsHeldError,
  ReservationAlreadyReleasedError,
  ReservationNotFoundError,
} from '../domain/errors';
import {Money} from '../domain/money';
import {Program} from '../domain/program';
import {Rate} from '../domain/rate';
import {Reservation} from '../domain/reservation';
import {ReleaseCapacity, ReleaseCapacityCommand} from './release-capacity.use-case';
import {FixedClock, inMemoryCapacity, InMemoryUnitOfWork} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-1';
const INVOICE_B = 'INV-B';
const USD = 'USD';
const EUR = 'EUR';
const CLIENT = 'client-e2e';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');
const TEN_MILLION_USD = Money.of(1_000_000_000n, USD);
const INVOICE_EUR = Money.of(275_000_000n, EUR);
const RESERVED_USD = Money.of(302_500_000n, USD);

const command = (overrides: Partial<ReleaseCapacityCommand> = {}): ReleaseCapacityCommand => ({
  programId: PROGRAM_ID,
  invoiceId: INVOICE_B,
  releaseId: 'R-1',
  amount: null,
  reason: 'repaid',
  clientId: CLIENT,
  ...overrides,
});

/** A program with one cross-currency reservation already on it, as S-04 would have left it. */
const withReservation = async (): Promise<{
  capacity: InMemoryUnitOfWork;
  reservation: Reservation;
}> => {
  const capacity = inMemoryCapacity();
  const program = Program.announce(PROGRAM_ID, USD);
  program.setLimit(TEN_MILLION_USD, AT_10_00, 'm-1');
  const reservation = Reservation.open({
    programId: PROGRAM_ID,
    invoiceId: INVOICE_B,
    invoiceAmount: INVOICE_EUR,
    reservedAmount: RESERVED_USD,
    rate: Rate.parse('1.10'),
    clientId: CLIENT,
    createdAt: AT_10_00,
  });
  const movement = program.reserve(reservation.held, CLIENT, reservation.reservationId, AT_10_00);
  await capacity.repositories.programs.save(program);
  await capacity.repositories.reservations.add(reservation);
  await capacity.repositories.ledger.append(movement);
  return {capacity, reservation};
};

describe('ReleaseCapacity', () => {
  it('should convert the release with the stored rate, lower held and give capacity back', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    const reservation = await useCase.execute(command({amount: 100_000_000n, releaseId: 'R-1'}));

    expect(reservation.describe()).toMatchObject({
      held: 192_500_000n,
      releasedInvoiceAmount: 100_000_000n,
      status: 'active',
    });
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(
      Money.of(192_500_000n, USD),
    );
    const movements = capacity.repositories.ledger.movements;
    expect(movements[movements.length - 1]).toMatchObject({
      kind: 'release',
      deltaHeld: -110_000_000n,
      releaseId: 'R-1',
      reason: 'repaid',
      attribution: {clientId: CLIENT},
    });
  });

  it('should treat an absent amount as everything left and close the reservation', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    const reservation = await useCase.execute(command({amount: null}));

    expect(reservation.status).toBe('closed');
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(Money.zero(USD));
  });

  it('should answer PROGRAM_NOT_FOUND for a program the treasury never announced', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    await expect(useCase.execute(command())).rejects.toBeInstanceOf(ProgramNotFoundError);
  });

  it('should answer RESERVATION_NOT_FOUND for an invoice with no reservation on that program (AC-14)', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    await expect(useCase.execute(command({invoiceId: 'INV-NOBODY'}))).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
  });

  it('should answer RELEASE_ALREADY_PROCESSED with the original outcome for a repeated releaseId (AC-16)', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));
    await useCase.execute(command({amount: 100_000_000n, releaseId: 'R-1'}));
    // A later release moves held on, so `heldAfter` below is R-1's outcome and not the state
    // now: without it the assertion would pass whichever of the two the code reported.
    await useCase.execute(command({amount: 50_000_000n, releaseId: 'R-2'}));
    const movementsBefore = capacity.repositories.ledger.movements.length;

    const repeated = useCase.execute(command({amount: 50_000_000n, releaseId: 'R-1'}));

    await expect(repeated).rejects.toBeInstanceOf(ReleaseAlreadyProcessedError);
    await expect(repeated).rejects.toMatchObject({
      details: {appliedAt: AT_10_10, heldAfter: 192_500_000n},
    });
    expect(capacity.repositories.ledger.movements).toHaveLength(movementsBefore);
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(
      Money.of(137_500_000n, USD),
    );
  });

  it('should check the repeated releaseId before the amount, so a repeat is a conflict whatever it asks for', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));
    await useCase.execute(command({amount: 100_000_000n, releaseId: 'R-1'}));

    // An amount far beyond what is left would be RELEASE_EXCEEDS_HELD if it were judged first.
    const repeated = useCase.execute(command({amount: 999_000_000n, releaseId: 'R-1'}));

    await expect(repeated).rejects.toBeInstanceOf(ReleaseAlreadyProcessedError);
  });

  it('should refuse a release beyond what the invoice has left and write nothing (AC-13)', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    const failure = useCase.execute(command({amount: 275_000_001n}));

    await expect(failure).rejects.toBeInstanceOf(ReleaseExceedsHeldError);
    await expect(failure).rejects.toMatchObject({
      details: {held: 302_500_000n, remainingInvoiceAmount: 275_000_000n},
    });
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(RESERVED_USD);
  });

  it('should refuse a release on a reservation that holds nothing (AC-15)', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));
    await useCase.execute(command({amount: null, releaseId: 'R-1'}));

    await expect(useCase.execute(command({releaseId: 'R-2'}))).rejects.toBeInstanceOf(
      ReservationAlreadyReleasedError,
    );
  });

  it('should record the reason on the movement, cancelled as readily as repaid (AC-17)', async () => {
    const {capacity} = await withReservation();
    const useCase = new ReleaseCapacity(capacity, new FixedClock(AT_10_10));

    await useCase.execute(command({amount: 100_000_000n, reason: 'cancelled'}));

    const movements = capacity.repositories.ledger.movements;
    expect(movements[movements.length - 1]).toMatchObject({reason: 'cancelled'});
  });
});
