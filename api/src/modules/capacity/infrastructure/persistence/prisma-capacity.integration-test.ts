import {randomUUID} from 'node:crypto';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {PrismaService} from '../../../../persistence/prisma.service';
import {CapacityMovement} from '../../domain/capacity-movement';
import {Money} from '../../domain/money';
import {Rate} from '../../domain/rate';
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
      rate: Rate.one(),
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

  it('should keep a rate exact through NUMERIC(20,8) and read it back canonical (ADR-0006)', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const reservation = Reservation.open({
      programId,
      invoiceId: 'INV-RATE',
      invoiceAmount: ONE_MILLION_EUR,
      reservedAmount: ONE_MILLION_EUR,
      rate: Rate.parse('0.00670000'),
      clientId: CLIENT,
      createdAt: AT_10_10,
    });

    await unitOfWork.run(({reservations}) => reservations.add(reservation));
    const read = await new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-RATE');

    expect(read?.rate.toString()).toBe('0.0067');
    expect(read?.rate.equals(Rate.parse('0.0067'))).toBe(true);
  });

  it('should read back a rate at the eight places the contract allows, not in exponential form', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const smallest = Rate.parse('0.00000001');
    await unitOfWork.run(({reservations}) =>
      reservations.add(
        Reservation.open({
          programId,
          invoiceId: 'INV-SMALL',
          invoiceAmount: ONE_MILLION_EUR,
          reservedAmount: ONE_MILLION_EUR,
          rate: smallest,
          clientId: CLIENT,
          createdAt: AT_10_10,
        }),
      ),
    );

    const read = await new PrismaReservationRepository(prisma).findByInvoice(
      programId,
      'INV-SMALL',
    );

    expect(read?.rate.toString()).toBe('0.00000001');
  });

  it('should refuse a second reservation for the same program and invoice (A-07)', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    await unitOfWork.run(({reservations}) => reservations.add(openReservation(programId, 'INV-A')));

    await expect(
      unitOfWork.run(({reservations}) => reservations.add(openReservation(programId, 'INV-A'))),
    ).rejects.toThrow(/unique/i);
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

  it('should refuse a rate that is not positive, so no row can be written that cannot be read back', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);

    // The mapper cannot produce such a row (`Rate.parse` refuses it), so the constraint is hit
    // directly: `Rate.parse` would throw on the way out, making every later read a 500, which
    // is the failure review round 1 of S-04 found for a rate it could not parse.
    await expect(
      prisma.withClient(
        (client) => client.$executeRaw`
          INSERT INTO reservations
            (id, program_id, invoice_id, invoice_amount, invoice_currency, currency,
             reserved_amount, held, released_invoice_amount, rate, source, client_id,
             created_at, updated_at)
          VALUES (gen_random_uuid(), ${programId}, 'INV-ZERO', 1, ${EUR}, ${EUR}, 1, 1, 0, 0,
                  'client'::reservation_source, ${CLIENT}, ${AT_10_10}, ${AT_10_10})`,
      ),
    ).rejects.toThrow(/reservations_rate_positive/);
  });

  it('should save what a release moved and read it back', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const reservation = openReservation(programId, 'INV-SAVE');
    await unitOfWork.run(({reservations}) => reservations.add(reservation));

    reservation.release({
      amount: Money.of(400_000n, EUR),
    });
    await unitOfWork.run(({reservations}) => reservations.save(reservation));

    const read = await new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-SAVE');
    expect(read?.held).toEqual(reservation.held);
    expect(read?.releasedInvoiceAmount).toEqual(Money.of(400_000n, EUR));
    expect(read?.remainingInvoiceAmount).toEqual(Money.of(99_600_000n, EUR));
  });

  it('should refuse the same releaseId twice on one reservation and allow it on another (ADR-0009)', async () => {
    const programId = uniqueId('PRG');
    const program = await announcedProgram(programId);
    const first = openReservation(programId, 'INV-ONE');
    const second = openReservation(programId, 'INV-TWO');
    await unitOfWork.run(async ({reservations}) => {
      await reservations.add(first);
      await reservations.add(second);
    });
    await unitOfWork.run(({ledger}) =>
      ledger.append(program.reserve(first.held, CLIENT, first.reservationId, AT_10_00)),
    );
    const releaseMovement = (reservation: Reservation): CapacityMovement =>
      program.release({
        deltaHeld: -1n,
        clientId: CLIENT,
        reservationId: reservation.reservationId,
        releaseId: 'R-1',
        reason: 'repaid',
        occurredAt: AT_10_10,
      });

    await unitOfWork.run(({ledger}) => ledger.append(releaseMovement(first)));

    // The same id on another invoice is a different repayment, so the index must allow it.
    await unitOfWork.run(({ledger}) => ledger.append(releaseMovement(second)));
    // The same id on the same reservation is the same repayment, and the index says so.
    await expect(
      unitOfWork.run(({ledger}) => ledger.append(releaseMovement(first))),
    ).rejects.toThrow(/reservation_id_release_id/);
  });

  it('should return a reservation movements in the order they were appended', async () => {
    const programId = uniqueId('PRG');
    const program = await announcedProgram(programId);
    const reservation = openReservation(programId, 'INV-ORDER');
    await unitOfWork.run(({reservations}) => reservations.add(reservation));
    const reserveMovement = program.reserve(
      reservation.held,
      CLIENT,
      reservation.reservationId,
      AT_10_00,
    );
    const releaseMovement = program.release({
      deltaHeld: -1n,
      clientId: CLIENT,
      reservationId: reservation.reservationId,
      releaseId: 'R-9',
      reason: 'cancelled',
      occurredAt: AT_10_10,
    });

    // Appended newest first, so a query without an order would hand them back that way and the
    // assertion below would catch it. AC-16's prefix sum over these rows depends on the order.
    await unitOfWork.run(async ({ledger}) => {
      await ledger.append(releaseMovement);
      await ledger.append(reserveMovement);
    });

    const rows = await new PrismaLedgerRepository(prisma).findByReservation(
      reservation.reservationId,
    );
    expect(rows.map((row) => [row.kind, row.releaseId, row.reason])).toEqual([
      ['release', 'R-9', 'cancelled'],
      ['reserve', null, null],
    ]);
  });

  it('should hold one instant across several reads, so a writer between them cannot split the view', async () => {
    // AC-19 reads the reservation and then its movements. One transaction is not enough: at
    // read committed each statement takes its own snapshot, so a release committing in between
    // would be invisible to the first read and visible to the second, and the body would
    // contradict itself. This proves the property rather than the setting: a committed write
    // from another connection, made between two reads inside the snapshot, is not seen.
    const programId = uniqueId('PRG');
    await announcedProgram(programId);
    const reservation = openReservation(programId, 'INV-SNAP');
    await unitOfWork.run(({reservations}) => reservations.add(reservation));

    const seen = await unitOfWork.readSnapshot(async ({reservations}) => {
      const before = await reservations.findByInvoice(programId, 'INV-SNAP');
      await prisma.withClient((client) =>
        client.reservation.update({
          where: {id: reservation.reservationId},
          data: {held: 1n},
        }),
      );
      const after = await reservations.findByInvoice(programId, 'INV-SNAP');
      return {before: before?.held.amount, after: after?.held.amount};
    });

    expect(seen.after).toBe(seen.before);
    // and the write really did land, so the test is not passing because nothing happened
    const now = await new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-SNAP');
    expect(now?.held.amount).toBe(1n);
  });

  it('should refuse a release recorded with an unknown reason', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);

    // The mapper refuses an unknown reason on the way out; this is what makes that claim true,
    // because nothing else stops another writer putting one in.
    await expect(
      prisma.withClient(
        (client) => client.$executeRaw`
          INSERT INTO capacity_movements
            (program_id, kind, currency, delta_held, limit_after, reserved_after,
             available_after, client_id, reason, occurred_at)
          VALUES (${programId}, 'release'::capacity_movement_kind, ${EUR}, 0, 0, 0, 0,
                  ${CLIENT}, 'refunded', ${AT_10_10})`,
      ),
    ).rejects.toThrow(/capacity_movements_reason_known/);
  });

  it('should refuse a reservation that has released more than its invoice', async () => {
    const programId = uniqueId('PRG');
    await announcedProgram(programId);

    await expect(
      prisma.withClient(
        (client) => client.$executeRaw`
          INSERT INTO reservations
            (id, program_id, invoice_id, invoice_amount, invoice_currency, currency,
             reserved_amount, held, released_invoice_amount, rate, source, client_id,
             created_at, updated_at)
          VALUES (gen_random_uuid(), ${programId}, 'INV-OVER', 100, ${EUR}, ${EUR}, 100, 0, 101,
                  1, 'client'::reservation_source, ${CLIENT}, ${AT_10_10}, ${AT_10_10})`,
      ),
    ).rejects.toThrow(/reservations_released_within_invoice/);
  });

  describe('reconciliation reads', () => {
    const AT_10_30 = new Date('2026-09-21T10:30:00.000Z');
    const AT_11_00 = new Date('2026-09-21T11:00:00.000Z');
    const AT_12_00 = new Date('2026-09-21T12:00:00.000Z');

    /** A program holding INV-A (active) and INV-B (fully released), with their ledger rows. */
    const programWithTwoReservations = async (): Promise<{
      programId: string;
      invoiceA: Reservation;
      invoiceB: Reservation;
    }> => {
      const programId = uniqueId('PRG');
      const program = await announcedProgram(programId);
      const invoiceA = openReservation(programId, 'INV-A');
      const invoiceB = openReservation(programId, 'INV-B');
      const reserveA = program.reserve(invoiceA.held, CLIENT, invoiceA.reservationId, AT_10_10);
      const reserveB = program.reserve(invoiceB.held, CLIENT, invoiceB.reservationId, AT_10_10);
      const release = invoiceB.release({amount: null});
      const releaseB = program.release({
        deltaHeld: release.deltaHeld,
        clientId: CLIENT,
        reservationId: invoiceB.reservationId,
        releaseId: 'R-1',
        reason: 'repaid',
        occurredAt: AT_11_00,
      });
      const adjustA = program.adjust({
        deltaHeld: -1n,
        reservationId: invoiceA.reservationId,
        messageId: uniqueId('m'),
        occurredAt: AT_12_00,
      });
      await unitOfWork.run(async ({programs, reservations, ledger}) => {
        await programs.save(program);
        await reservations.add(invoiceA);
        await reservations.add(invoiceB);
        for (const movement of [reserveA, reserveB, releaseB, adjustA]) {
          await ledger.append(movement);
        }
      });
      return {programId, invoiceA, invoiceB};
    };

    it('should list only the active reservations of one program', async () => {
      const {programId, invoiceA} = await programWithTwoReservations();
      await programWithTwoReservations();

      const active = await new PrismaReservationRepository(prisma).findActiveByProgram(programId);

      expect(active.map((r) => r.reservationId)).toEqual([invoiceA.reservationId]);
    });

    it('should find the listed invoices of one program whatever their status', async () => {
      const {programId, invoiceA, invoiceB} = await programWithTwoReservations();

      const found = await new PrismaReservationRepository(prisma).findByInvoices(programId, [
        'INV-A',
        'INV-B',
        'INV-nobody',
      ]);

      expect(found.map((r) => r.reservationId).sort()).toEqual(
        [invoiceA.reservationId, invoiceB.reservationId].sort(),
      );
      await expect(
        new PrismaReservationRepository(prisma).findByInvoices(programId, []),
      ).resolves.toEqual([]);
    });

    it('should return only client movements after the given moment', async () => {
      const {programId, invoiceB} = await programWithTwoReservations();

      const after = await new PrismaLedgerRepository(prisma).findClientMovementsSince(
        programId,
        AT_10_30,
      );

      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({
        kind: 'release',
        reservationId: invoiceB.reservationId,
        occurredAt: AT_11_00,
      });
    });

    it('should keep a reservation born from a snapshot, and a correction, through a save and a read (ADR-0011, ADR-0012)', async () => {
      const programId = uniqueId('PRG');
      await announcedProgram(programId);
      const born = Reservation.fromSnapshot({
        programId,
        invoiceId: 'INV-X',
        held: ONE_MILLION_EUR,
        asOf: AT_12_00,
      });
      await unitOfWork.run(({reservations}) => reservations.add(born));

      born.correctTo(Money.of(90_000_000n, EUR));
      await unitOfWork.run(({reservations}) => reservations.save(born));

      const read = await new PrismaReservationRepository(prisma).findByInvoice(programId, 'INV-X');
      expect(read).toEqual(born);
      expect(read?.heldCorrection).toBe(-10_000_000n);
      expect(read?.source).toBe('reconciliation');
      expect(read?.clientId).toBeNull();
      expect(read?.createdAt).toEqual(AT_12_00);
    });
  });
});
