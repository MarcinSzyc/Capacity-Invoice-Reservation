import {INestApplication} from '@nestjs/common';
import {Ledger} from '../../src/modules/capacity/domain/ledger';
import {Money} from '../../src/modules/capacity/domain/money';
import {toReservation} from '../../src/modules/capacity/infrastructure/persistence/mappers';
import {PrismaLedgerRepository} from '../../src/modules/capacity/infrastructure/persistence/prisma-ledger.repository';
import {PrismaProgramRepository} from '../../src/modules/capacity/infrastructure/persistence/prisma-program.repository';
import {PrismaService} from '../../src/persistence/prisma.service';

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

export const expectProgramLedgerInvariants = async (
  app: INestApplication,
  programId: string,
): Promise<void> => {
  const prisma = app.get(PrismaService);
  const program = await new PrismaProgramRepository(prisma).findById(programId);
  if (program === null) throw new Error(`program ${programId} is missing`);
  const movements = await new PrismaLedgerRepository(prisma).findByProgram(programId);
  const rows = await prisma.withClient((client) =>
    client.reservation.findMany({where: {programId}, orderBy: {createdAt: 'asc'}}),
  );
  const reservations = rows.map(toReservation);

  // INV-04: the chain holds and recomputes to the stored program.
  const recomputed = Ledger.recompute(movements);
  expect(`${programId}: ${describe(recomputed)}`).toBe(`${programId}: ok`);
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

const describe = (recomputed: ReturnType<typeof Ledger.recompute>): string =>
  recomputed.ok ? 'ok' : `broken at row ${recomputed.rowIndex}: ${recomputed.reason}`;
