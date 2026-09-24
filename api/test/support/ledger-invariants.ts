import {INestApplication} from '@nestjs/common';
import type {Prisma} from '../../src/generated/prisma/client';
import {CapacityMovement} from '../../src/modules/capacity/domain/capacity-movement';
import {Ledger} from '../../src/modules/capacity/domain/ledger';
import {Money} from '../../src/modules/capacity/domain/money';
import {Program} from '../../src/modules/capacity/domain/program';
import {Reservation} from '../../src/modules/capacity/domain/reservation';
import {
  toMovement,
  toProgram,
  toReservation,
} from '../../src/modules/capacity/infrastructure/persistence/mappers';
import {PrismaService} from '../../src/persistence/prisma.service';

interface ProgramSnapshot {
  readonly program: Program;
  readonly movements: CapacityMovement[];
  readonly reservations: Reservation[];
}

const byProgram = <T>(rows: readonly T[], programId: (row: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = programId(row);
    const existing = grouped.get(key);
    if (existing === undefined) grouped.set(key, [row]);
    else existing.push(row);
  }
  return grouped;
};

/**
 * Every program in the test database, read in one repeatable-read transaction so a writer
 * running at the same time cannot split the view between the three reads.
 *
 * Three queries for the whole database rather than three per program: S-03 chose to check every
 * program rather than track ids per test, which is simpler and stronger, but a transaction per
 * program made the hook grow with the size of the database and it eventually ran past the
 * 180 s hook timeout in a full e2e run (found while implementing S-05). The guarantee is
 * unchanged; only the number of round trips is.
 */
const snapshotAll = (prisma: PrismaService): Promise<ProgramSnapshot[]> =>
  prisma.withClient((client) =>
    client.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const [programs, movements, reservations] = await Promise.all([
          transaction.program.findMany(),
          transaction.capacityMovement.findMany({orderBy: {id: 'asc'}}),
          transaction.reservation.findMany({orderBy: {createdAt: 'asc'}}),
        ]);
        const movementsBy = byProgram(movements, (row) => row.programId);
        const reservationsBy = byProgram(reservations, (row) => row.programId);
        return programs.map((row) => ({
          program: toProgram(row),
          movements: (movementsBy.get(row.programId) ?? []).map(toMovement),
          reservations: (reservationsBy.get(row.programId) ?? []).map(toReservation),
        }));
      },
      {isolationLevel: 'RepeatableRead'},
    ),
  );

/**
 * INV-03 and INV-04 after every e2e scenario: for every program in the test database, the ledger
 * recomputes to the stored program balances, `reserved` equals the sum of `held` of the active
 * reservations, and every reservation holds what its movements say.
 */
export const expectLedgerInvariants = async (app: INestApplication): Promise<void> => {
  for (const snapshot of await snapshotAll(app.get(PrismaService))) {
    expectProgramLedgerInvariants(snapshot);
  }
};

const expectProgramLedgerInvariants = ({
  program,
  movements,
  reservations,
}: ProgramSnapshot): void => {
  const programId = program.programId;

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
