import {randomUUID} from 'node:crypto';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {PrismaService} from '../../../../persistence/prisma.service';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {Reservation} from '../../domain/reservation';
import {PrismaLedgerRepository} from './prisma-ledger.repository';
import {PrismaProgramRepository} from './prisma-program.repository';
import {PrismaReservationRepository} from './prisma-reservation.repository';
import {PrismaTreasuryMessageStore} from './prisma-treasury-message.store';
import {PrismaUnitOfWork} from './prisma-unit-of-work';

const EUR = 'EUR';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');
const FIVE_MILLION_EUR = Money.of(500_000_000n, EUR);
const ONE_MILLION_EUR = Money.of(100_000_000n, EUR);
const CLIENT = 'client-e2e';
const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');

const uniqueId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

describe('Prisma capacity adapters', () => {
  let prisma: PrismaService;
  let unitOfWork: PrismaUnitOfWork;

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env), new JsonLogger());
    await prisma.onModuleInit();
    unitOfWork = new PrismaUnitOfWork(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('should save a program and read it back with the same balances, currency and times', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));

    await unitOfWork.run(({programs}) => programs.save(program));

    const read = await new PrismaProgramRepository(prisma).findById(programId);
    expect(read?.programId).toBe(programId);
    expect(read?.currency).toBe(EUR);
    expect(read?.limit).toEqual(FIVE_MILLION_EUR);
    expect(read?.reserved).toEqual(Money.zero(EUR));
    expect(read?.limitEventTime).toEqual(AT_10_00);
    expect(read?.asOf).toBeNull();
  });

  it('should answer null for a program the treasury never announced', async () => {
    await expect(new PrismaProgramRepository(prisma).findById('PRG-nobody')).resolves.toBeNull();
    await expect(
      unitOfWork.run(({programs}) => programs.lockById('PRG-nobody')),
    ).resolves.toBeNull();
  });

  it('should append a limit_set movement attributed to its message and read it back in order', async () => {
    const programId = uniqueId('PRG');
    const messageId = uniqueId('m');
    const program = Program.announce(programId, EUR);
    const outcome = program.setLimit(FIVE_MILLION_EUR, AT_10_00, messageId);
    if (outcome.kind !== 'applied') throw new Error('expected the first limit to apply');

    await unitOfWork.run(async ({programs, ledger}) => {
      await programs.save(program);
      await ledger.append(outcome.movement);
    });

    const rows = await new PrismaLedgerRepository(prisma).findByProgram(programId);
    expect(rows).toEqual([outcome.movement]);
  });

  it('should record a message outcome once and count every repetition on the same row', async () => {
    const messageId = uniqueId('m');
    const store = new PrismaTreasuryMessageStore(prisma);
    const record = {
      messageId,
      programId: 'PRG-1',
      type: 'capacity_update',
      payload: {messageId, creditLimit: 1},
      outcome: 'applied' as const,
      error: null,
      receivedAt: RECEIVED_AT,
    };

    await expect(store.wasProcessed(messageId)).resolves.toBe(false);
    await store.recordOutcome(record);
    await store.recordDuplicate(messageId);
    await store.recordDuplicate(messageId);

    await expect(store.wasProcessed(messageId)).resolves.toBe(true);
    expect(await store.findById(messageId)).toMatchObject({...record, duplicateCount: 2});
  });

  it('should roll back everything the work wrote when it throws', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));

    await expect(
      unitOfWork.run(async ({programs}) => {
        await programs.save(program);
        throw new Error('something after the write failed');
      }),
    ).rejects.toThrow('something after the write failed');

    await expect(new PrismaProgramRepository(prisma).findById(programId)).resolves.toBeNull();
  });

  it('should make a second unit of work wait for the row lock until the first commits', async () => {
    const programId = uniqueId('PRG');
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));
    await unitOfWork.run(({programs}) => programs.save(program));
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstHolds = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = unitOfWork.run(async ({programs}) => {
      await programs.lockById(programId);
      order.push('first locked');
      await firstHolds;
      order.push('first done');
    });
    const second = unitOfWork.run(async ({programs}) => {
      await programs.lockById(programId);
      order.push('second locked');
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first locked', 'first done', 'second locked']);
  });

  const announcedProgram = async (programId: string): Promise<Program> => {
    const program = Program.announce(programId, EUR);
    program.setLimit(FIVE_MILLION_EUR, AT_10_00, uniqueId('m'));
    await unitOfWork.run(({programs}) => programs.save(program));
    return program;
  };

  const openReservation = (
    programId: string,
    invoiceId: string,
    createdAt: Date = AT_10_10,
  ): Reservation =>
    Reservation.open({
      programId,
      invoiceId,
      invoiceAmount: ONE_MILLION_EUR,
      reservedAmount: ONE_MILLION_EUR,
      clientId: CLIENT,
      createdAt,
    });

  it('should add a reservation and find it by its invoice with the same amounts, source, client and time', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const reservation = openReservation(programId, 'INV-A');

    await unitOfWork.run(({reservations}) => reservations.add(reservation));

    const read = await new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-A');
    expect(read).toEqual(reservation);
    expect(read?.status).toBe('active');
    await expect(
      new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-nobody'),
    ).resolves.toBeNull();
  });

  it('should refuse a second reservation for the same program and invoice (A-07)', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    await unitOfWork.run(({reservations}) => reservations.add(openReservation(programId, 'INV-A')));

    await expect(
      unitOfWork.run(({reservations}) => reservations.add(openReservation(programId, 'INV-A'))),
    ).rejects.toThrow(/unique/i);
  });

  it('should list the active reservations of a program in creation order and leave out closed ones', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const first = openReservation(programId, 'INV-1', AT_10_10);
    const second = openReservation(programId, 'INV-2', AT_10_00);
    const closed = Reservation.rehydrate({
      reservationId: randomUUID(),
      programId,
      invoiceId: 'INV-3',
      invoiceAmount: ONE_MILLION_EUR,
      reservedAmount: ONE_MILLION_EUR,
      held: Money.zero(EUR),
      source: 'client',
      clientId: CLIENT,
      createdAt: AT_10_10,
    });
    await unitOfWork.run(async ({reservations}) => {
      await reservations.add(second);
      await reservations.add(first);
      await reservations.add(closed);
    });

    const active = await new PrismaReservationRepository(prisma).findActiveByProgram(programId);

    expect(active.map((r) => r.invoiceId)).toEqual(['INV-2', 'INV-1']);
  });

  it('should point a reserve movement at its reservation and refuse one that names a reservation that does not exist', async () => {
    const programId = uniqueId('PRG');
    const program = await announcedProgram(programId);
    const reservation = openReservation(programId, 'INV-A');
    const movement = program.reserve(reservation.held, CLIENT, reservation.reservationId, AT_10_10);

    await unitOfWork.run(async ({reservations, ledger}) => {
      await reservations.add(reservation);
      await ledger.append(movement);
    });
    const rows = await new PrismaLedgerRepository(prisma).findByProgram(programId);
    expect(rows.map((row) => row.reservationId)).toEqual([reservation.reservationId]);

    const orphan = {...movement, reservationId: randomUUID()};
    await expect(unitOfWork.run(({ledger}) => ledger.append(orphan))).rejects.toThrow(
      /foreign key/i,
    );
  });

  it('[INV-09] should reject a movement that carries neither clientId nor messageId', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);

    // The mapper cannot produce such a row (the attribution is a union), so the constraint is
    // hit directly: it is what protects the ledger from any other writer.
    await expect(
      prisma.withClient(
        (client) => client.$executeRaw`
          INSERT INTO capacity_movements
            (program_id, kind, currency, delta_held, limit_after, reserved_after, available_after, occurred_at)
          VALUES (${programId}, 'reserve'::capacity_movement_kind, ${EUR}, 1, 1, 1, 0, ${AT_10_10})`,
      ),
    ).rejects.toThrow(/capacity_movements_attributable/);
  });
});
