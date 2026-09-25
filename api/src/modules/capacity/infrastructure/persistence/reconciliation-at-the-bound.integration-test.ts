import {randomUUID} from 'node:crypto';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {PrismaService} from '../../../../persistence/prisma.service';
import {SNAPSHOT_RESERVATIONS_MAX} from '../../domain/identifier-limits';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {Rate} from '../../domain/rate';
import {Reservation} from '../../domain/reservation';
import {PrismaProgramRepository} from './prisma-program.repository';
import {PrismaUnitOfWork} from './prisma-unit-of-work';
import {SystemClock} from '../system-clock';
import {ApplyReconciliationSnapshot} from '../../application/apply-reconciliation-snapshot.use-case';

const USD = 'USD';
const KEEP_WINDOW_MS = 30_000;
const AS_OF = new Date('2026-09-21T18:00:00.000Z');
const HELD_EACH = 1_000n;
const TEST_TIMEOUT_MS = 120_000;
// A program's active reservations are not bounded by the list bound (review round 3 of S-06).
const BEYOND_THE_BOUND = 2 * SNAPSHOT_RESERVATIONS_MAX;
const CLIENT = 'client-bound';

describe('ApplyReconciliationSnapshot against PostgreSQL', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env), new JsonLogger());
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it(
    'should apply a snapshot at the list bound in one transaction (S-06 local decision 5)',
    async () => {
      const programId = `PRG-${randomUUID().slice(0, 8)}`;
      const useCase = new ApplyReconciliationSnapshot(
        new PrismaUnitOfWork(prisma),
        new SystemClock(),
        KEEP_WINDOW_MS,
      );
      const activeReservations = Array.from({length: SNAPSHOT_RESERVATIONS_MAX}, (_, index) => ({
        invoiceId: `INV-${index}`,
        heldAmount: HELD_EACH,
      }));

      const started = Date.now();
      const result = await useCase.execute({
        messageId: `m-${randomUUID()}`,
        programId,
        currency: USD,
        creditLimit: 1_000_000_000n,
        asOf: AS_OF,
        activeReservations,
        payload: {},
        receivedAt: new Date(),
      });
      process.stdout.write(
        `snapshot of ${SNAPSHOT_RESERVATIONS_MAX} applied in ${Date.now() - started} ms\n`,
      );

      expect(result).toMatchObject({outcome: 'applied'});
      const program = await new PrismaProgramRepository(prisma).findById(programId);
      expect(program?.reserved).toEqual(
        Money.of(HELD_EACH * BigInt(SNAPSHOT_RESERVATIONS_MAX), USD),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'should correct every reservation of a snapshot at the list bound in one transaction',
    async () => {
      const programId = `PRG-${randomUUID().slice(0, 8)}`;
      const useCase = new ApplyReconciliationSnapshot(
        new PrismaUnitOfWork(prisma),
        new SystemClock(),
        KEEP_WINDOW_MS,
      );
      const listed = (heldAmount: bigint): {invoiceId: string; heldAmount: bigint}[] =>
        Array.from({length: SNAPSHOT_RESERVATIONS_MAX}, (_, index) => ({
          invoiceId: `INV-${index}`,
          heldAmount,
        }));
      const snapshot = (asOf: Date, heldAmount: bigint): Parameters<typeof useCase.execute>[0] => ({
        messageId: `m-${randomUUID()}`,
        programId,
        currency: USD,
        creditLimit: 1_000_000_000n,
        asOf,
        activeReservations: listed(heldAmount),
        payload: {},
        receivedAt: new Date(),
      });
      await useCase.execute(snapshot(AS_OF, HELD_EACH));

      const started = Date.now();
      const result = await useCase.execute(
        snapshot(new Date(AS_OF.getTime() + 3_600_000), HELD_EACH - 1n),
      );
      process.stdout.write(
        `correction of ${SNAPSHOT_RESERVATIONS_MAX} applied in ${Date.now() - started} ms\n`,
      );

      expect(result).toMatchObject({outcome: 'applied'});
      const program = await new PrismaProgramRepository(prisma).findById(programId);
      expect(program?.reserved).toEqual(
        Money.of((HELD_EACH - 1n) * BigInt(SNAPSHOT_RESERVATIONS_MAX), USD),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'should reopen every reservation of a snapshot at the list bound in one transaction',
    async () => {
      const programId = `PRG-${randomUUID().slice(0, 8)}`;
      const useCase = new ApplyReconciliationSnapshot(
        new PrismaUnitOfWork(prisma),
        new SystemClock(),
        KEEP_WINDOW_MS,
      );
      const hour = (offset: number): Date => new Date(AS_OF.getTime() + offset * 3_600_000);
      const snapshot = (
        asOf: Date,
        listed: {invoiceId: string; heldAmount: bigint}[],
      ): Parameters<typeof useCase.execute>[0] => ({
        messageId: `m-${randomUUID()}`,
        programId,
        currency: USD,
        creditLimit: 1_000_000_000n,
        asOf,
        activeReservations: listed,
        payload: {},
        receivedAt: new Date(),
      });
      const all = Array.from({length: SNAPSHOT_RESERVATIONS_MAX}, (_, index) => ({
        invoiceId: `INV-${index}`,
        heldAmount: HELD_EACH,
      }));
      await useCase.execute(snapshot(hour(0), all));
      await useCase.execute(snapshot(hour(1), []));

      const started = Date.now();
      const result = await useCase.execute(snapshot(hour(2), all));
      process.stdout.write(
        `reopen of ${SNAPSHOT_RESERVATIONS_MAX} applied in ${Date.now() - started} ms\n`,
      );

      expect(result).toMatchObject({outcome: 'applied'});
      const program = await new PrismaProgramRepository(prisma).findById(programId);
      expect(program?.reserved).toEqual(
        Money.of(HELD_EACH * BigInt(SNAPSHOT_RESERVATIONS_MAX), USD),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'should release by omission more active reservations than the list bound in one transaction',
    async () => {
      const programId = `PRG-${randomUUID().slice(0, 8)}`;
      const unitOfWork = new PrismaUnitOfWork(prisma);
      const createdAt = new Date(AS_OF.getTime() - 3_600_000);
      const program = Program.announce(programId, USD);
      program.setLimit(Money.of(1_000_000_000n, USD), createdAt, `m-${randomUUID()}`);
      const held = Money.of(HELD_EACH, USD);
      const reservations = Array.from({length: BEYOND_THE_BOUND}, (_, index) =>
        Reservation.open({
          programId,
          invoiceId: `INV-${index}`,
          invoiceAmount: held,
          reservedAmount: held,
          rate: Rate.one(),
          clientId: CLIENT,
          createdAt,
        }),
      );
      const movements = reservations.map((reservation) =>
        program.reserve(held, CLIENT, reservation.reservationId, createdAt),
      );
      await unitOfWork.run(async (repositories) => {
        await repositories.programs.save(program);
        await repositories.reservations.addAll(reservations);
        await repositories.ledger.appendAll(movements);
      });
      const useCase = new ApplyReconciliationSnapshot(
        unitOfWork,
        new SystemClock(),
        KEEP_WINDOW_MS,
      );

      const started = Date.now();
      const result = await useCase.execute({
        messageId: `m-${randomUUID()}`,
        programId,
        currency: USD,
        creditLimit: 1_000_000_000n,
        asOf: AS_OF,
        activeReservations: [],
        payload: {},
        receivedAt: new Date(),
      });
      process.stdout.write(
        `release by omission of ${BEYOND_THE_BOUND} applied in ${Date.now() - started} ms\n`,
      );

      expect(result).toMatchObject({outcome: 'applied'});
      const after = await new PrismaProgramRepository(prisma).findById(programId);
      expect(after?.reserved).toEqual(Money.zero(USD));
    },
    TEST_TIMEOUT_MS,
  );
});
