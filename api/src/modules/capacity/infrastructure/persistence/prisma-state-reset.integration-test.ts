import {randomUUID} from 'node:crypto';
import {JsonLogger} from '../../../../common/logging/json-logger';
import {loadConfig} from '../../../../config/configuration';
import {PrismaService} from '../../../../persistence/prisma.service';
import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {PrismaStateReset} from './prisma-state-reset';
import {PrismaUnitOfWork} from './prisma-unit-of-work';

const EUR = 'EUR';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');

describe('PrismaStateReset', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env), new JsonLogger());
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('should empty every table of the ledger', async () => {
    const program = Program.announce(`PRG-${randomUUID().slice(0, 8)}`, EUR);
    const outcome = program.setLimit(Money.of(500n, EUR), AT_10_00, `m-${randomUUID()}`);
    if (outcome.kind !== 'applied') throw new Error('expected the limit to apply');
    await new PrismaUnitOfWork(prisma).run(async ({programs, ledger}) => {
      await programs.save(program);
      await ledger.append(outcome.movement);
    });

    await new PrismaStateReset(prisma).resetAll();

    const counts = await prisma.withClient((client) =>
      Promise.all([
        client.program.count(),
        client.reservation.count(),
        client.capacityMovement.count(),
        client.treasuryMessage.count(),
        client.treasuryMessageFailure.count(),
      ]),
    );
    expect(counts).toEqual([0, 0, 0, 0, 0]);
  });
});
