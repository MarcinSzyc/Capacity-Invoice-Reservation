import {INestApplication} from '@nestjs/common';
import type {Prisma} from '../../src/generated/prisma/client';
import {Ledger} from '../../src/modules/capacity/domain/ledger';
import {Money} from '../../src/modules/capacity/domain/money';
import {Program} from '../../src/modules/capacity/domain/program';
import {Reservation} from '../../src/modules/capacity/domain/reservation';
import {TransactionScope} from '../../src/modules/capacity/infrastructure/persistence/client-access';
import {toReservation} from '../../src/modules/capacity/infrastructure/persistence/mappers';
import {PrismaLedgerRepository} from '../../src/modules/capacity/infrastructure/persistence/prisma-ledger.repository';
import {PrismaProgramRepository} from '../../src/modules/capacity/infrastructure/persistence/prisma-program.repository';
import {PrismaService} from '../../src/persistence/prisma.service';

interface ProgramSnapshot {
  readonly program: Program | null;
  readonly movements: Awaited<ReturnType<PrismaLedgerRepository['findByProgram']>>;
  readonly reservations: Reservation[];
}

/**
 * The three reads happen in one repeatable-read transaction, so a writer running at the same
 * time (another suite, another instance) cannot split the view between them.
 */
const snapshotOf = (prisma: PrismaService, programId: string): Promise<ProgramSnapshot> =>
  prisma.withClient((client) =>
    client.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const scope = new TransactionScope(transaction);
        const [program, movements, rows] = await Promise.all([
          new PrismaProgramRepository(scope).findById(programId),
          new PrismaLedgerRepository(scope).findByProgram(programId),
          transaction.reservation.findMany({where: {programId}, orderBy: {createdAt: 'asc'}}),
        ]);
        return {program, movements, reservations: rows.map(toReservation)};
      },
      {isolationLevel: 'RepeatableRead'},
    ),
  );

/**
 * INV-03 and INV-04 after every e2e scenario: for every program in the test database, the ledger
 * recomputes to the stored program balances, `reserved` equals the sum of `held` of the active
 * reservations, and every reservation holds what its movements say. One database, run in band,
 * so checking every program is simpler and stronger than tracking ids per test.
 */
export const expectLedgerInvariants = async (app: INestApplication): Promise<void> => {
  const prisma = app.get(PrismaService);
  const programIds = await prisma.withClient((client) =>
    client.program.findMany({select: {programId: true}}),
  );
  for (const {programId} of programIds) {
    await expectProgramLedgerInvariants(app, programId);
  }
};

const expectProgramLedgerInvariants = async (
  app: INestApplication,
  programId: string,
): Promise<void> => {
  const {program, movements, reservations} = await snapshotOf(app.get(PrismaService), programId);
  if (program === null) throw new Error(`program ${programId} is missing`);

  // INV-04: the chain holds and recomputes to the stored program.
  const recomputed = Ledger.recompute(movements);
  expect(`${programId}: ${explain(recomputed)}`).toBe(`${programId}: ok`);
  if (!recomputed.ok || recomputed.state === null) return;
  expect(`${programId} limit ${recomputed.state.limit.amount}`).toBe(
    `${programId} limit ${program.limit.amount}`,
  );
  expect(`${programId} reserved ${recomputed.state.reserved.amount}`).toBe(
    `${programId} reserved ${program.reserved.amount}`,
  );
  expect(`${programId} available ${recomputed.state.available.amount}`).toBe(
    `${programId} available ${program.available.amount}`,
  );

  // INV-04: every reservation holds what its movements say.
  for (const reservation of reservations) {
    const fromLedger =
      recomputed.state.heldByReservation.get(reservation.reservationId) ??
      Money.zero(reservation.held.currency);
    expect(`${programId}/${reservation.invoiceId} held ${fromLedger.amount}`).toBe(
      `${programId}/${reservation.invoiceId} held ${reservation.held.amount}`,
    );
  }

  // INV-03: program reserved equals the sum of held of the active reservations.
  const sumOfHeld = reservations
    .filter((reservation) => reservation.status === 'active')
    .reduce((sum, reservation) => sum + reservation.held.amount, 0n);
  expect(`${programId} sum of held ${sumOfHeld}`).toBe(
    `${programId} sum of held ${program.reserved.amount}`,
  );
};

const explain = (recomputed: ReturnType<typeof Ledger.recompute>): string =>
  recomputed.ok ? 'ok' : `broken at row ${recomputed.rowIndex}: ${recomputed.reason}`;
