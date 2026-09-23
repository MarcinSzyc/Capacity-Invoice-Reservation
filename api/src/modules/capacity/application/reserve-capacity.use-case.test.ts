import {
  CapacityExceededError,
  ProgramNotFoundError,
  RateValidationError,
  ReservationAlreadyExistsError,
} from '../domain/errors';
import {Money} from '../domain/money';
import {Rate} from '../domain/rate';
import {Program} from '../domain/program';
import {ReserveCapacity, ReserveCapacityCommand} from './reserve-capacity.use-case';
import {FixedClock, inMemoryCapacity, InMemoryUnitOfWork} from './testing/in-memory-capacity.fake';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const EUR = 'EUR';
const CLIENT = 'client-e2e';
const OTHER_CLIENT = 'client-other';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');
const TEN_MILLION_USD = Money.of(1_000_000_000n, USD);

const command = (overrides: Partial<ReserveCapacityCommand> = {}): ReserveCapacityCommand => ({
  programId: PROGRAM_ID,
  invoiceId: 'INV-A',
  invoiceAmount: 120_000_000n,
  invoiceCurrency: USD,
  rate: null,
  clientId: CLIENT,
  ...overrides,
});

const withProgram = async (limit: Money = TEN_MILLION_USD): Promise<InMemoryUnitOfWork> => {
  const capacity = inMemoryCapacity();
  const program = Program.announce(PROGRAM_ID, limit.currency);
  program.setLimit(limit, AT_10_00, 'm-1');
  await capacity.repositories.programs.save(program);
  return capacity;
};

describe('ReserveCapacity', () => {
  it('should open the reservation, raise reserved, append a reserve movement attributed to the client and stamp the clock', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const reservation = await useCase.execute(command());

    expect(reservation.describe()).toEqual({
      programId: PROGRAM_ID,
      invoiceId: 'INV-A',
      invoiceAmount: 120_000_000n,
      invoiceCurrency: USD,
      reservedAmount: 120_000_000n,
      held: 120_000_000n,
      rate: '1',
      status: 'active',
      source: 'client',
      createdAt: AT_10_10,
    });
    expect(reservation.clientId).toBe(CLIENT);
    expect(capacity.repositories.reservations.all).toEqual([reservation]);
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(
      Money.of(120_000_000n, USD),
    );
    expect(capacity.repositories.ledger.movements).toEqual([
      expect.objectContaining({
        kind: 'reserve',
        reservationId: reservation.reservationId,
        deltaHeld: Money.of(120_000_000n, USD),
        reservedAfter: Money.of(120_000_000n, USD),
        availableAfter: Money.of(880_000_000n, USD),
        attribution: {clientId: CLIENT},
        occurredAt: AT_10_10,
      }),
    ]);
  });

  it('should answer PROGRAM_NOT_FOUND for a program the treasury never announced (AC-04)', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    await expect(useCase.execute(command())).rejects.toBeInstanceOf(ProgramNotFoundError);
    expect(capacity.repositories.ledger.movements).toHaveLength(0);
  });

  it('should convert an invoice in another currency at the given rate and keep the rate (AC-06)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const reservation = await useCase.execute(
      command({invoiceAmount: 275_000_000n, invoiceCurrency: EUR, rate: Rate.parse('1.10')}),
    );

    expect(reservation.describe()).toMatchObject({
      invoiceAmount: 275_000_000n,
      invoiceCurrency: EUR,
      reservedAmount: 302_500_000n,
      held: 302_500_000n,
      rate: '1.1',
    });
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(
      Money.of(302_500_000n, USD),
    );
  });

  it('should refuse a cross-currency reservation with no rate, naming the field (AC-07)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const failure = useCase.execute(command({invoiceCurrency: EUR, rate: null}));

    await expect(failure).rejects.toBeInstanceOf(RateValidationError);
    await expect(failure).rejects.toMatchObject({field: 'rate'});
    expect(capacity.repositories.reservations.all).toHaveLength(0);
    expect(capacity.repositories.ledger.movements).toHaveLength(0);
  });

  it('should refuse a same-currency reservation whose rate is not one, naming the field (AC-07)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const failure = useCase.execute(command({rate: Rate.parse('1.05')}));

    await expect(failure).rejects.toBeInstanceOf(RateValidationError);
    await expect(failure).rejects.toMatchObject({field: 'rate'});
    expect(capacity.repositories.reservations.all).toHaveLength(0);
  });

  it('should accept a same-currency reservation with no rate or with one, and record one (A-10)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const absent = await useCase.execute(command({rate: null}));
    const spelled = await useCase.execute(command({invoiceId: 'INV-B', rate: Rate.parse('1.00')}));

    expect(absent.rate.toString()).toBe('1');
    expect(spelled.rate.toString()).toBe('1');
  });

  it('should refuse an amount that converts to nothing, naming the amount rather than failing later', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    const failure = useCase.execute(
      command({invoiceAmount: 1n, invoiceCurrency: EUR, rate: Rate.parse('0.001')}),
    );

    await expect(failure).rejects.toBeInstanceOf(RateValidationError);
    await expect(failure).rejects.toMatchObject({field: 'invoiceAmount'});
    expect(capacity.repositories.reservations.all).toHaveLength(0);
  });

  it('should answer RESERVATION_ALREADY_EXISTS with the existing reservation for a repeated invoice, whatever the amount, and change nothing (AC-05)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));
    const existing = await useCase.execute(command());

    let thrown: unknown;
    try {
      await useCase.execute(command({invoiceAmount: 1n, clientId: OTHER_CLIENT}));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ReservationAlreadyExistsError);
    expect((thrown as ReservationAlreadyExistsError).details).toEqual({
      reservation: existing.describe(),
    });
    expect(capacity.repositories.reservations.all).toHaveLength(1);
    expect(capacity.repositories.ledger.movements).toHaveLength(1);
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(
      Money.of(120_000_000n, USD),
    );
  });

  it('should check the duplicate before the capacity, so a repeated invoice on a full program is a conflict, not a shortage', async () => {
    const capacity = await withProgram(Money.of(120_000_000n, USD));
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));
    await useCase.execute(command());

    await expect(useCase.execute(command({invoiceAmount: 1n}))).rejects.toBeInstanceOf(
      ReservationAlreadyExistsError,
    );
  });

  it('should refuse a reservation beyond available capacity and leave every store untouched (AC-03)', async () => {
    const capacity = await withProgram(Money.of(50_000_000n, USD));
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));

    let thrown: unknown;
    try {
      await useCase.execute(command({invoiceAmount: 50_000_001n}));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CapacityExceededError);
    expect((thrown as CapacityExceededError).details).toEqual({available: 50_000_000n});
    expect(capacity.repositories.reservations.all).toHaveLength(0);
    expect(capacity.repositories.ledger.movements).toHaveLength(0);
    expect(capacity.repositories.programs.byId.get(PROGRAM_ID)?.reserved).toEqual(Money.zero(USD));
  });

  it('should check the duplicate before the rate, so a repeated invoice is a conflict whatever rate it carries (AC-05)', async () => {
    const capacity = await withProgram();
    const useCase = new ReserveCapacity(capacity, new FixedClock(AT_10_10));
    await useCase.execute(command());

    const repeated = useCase.execute(command({invoiceCurrency: EUR, rate: null}));

    await expect(repeated).rejects.toBeInstanceOf(ReservationAlreadyExistsError);
    expect(capacity.repositories.reservations.all).toHaveLength(1);
  });
});
