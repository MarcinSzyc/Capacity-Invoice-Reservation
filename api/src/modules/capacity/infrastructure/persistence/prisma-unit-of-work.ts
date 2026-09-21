import {Injectable} from '@nestjs/common';
import {PrismaService} from '../../../../persistence/prisma.service';
import {CapacityRepositories, UnitOfWork} from '../../domain/ports/unit-of-work';
import {TransactionScope} from './client-access';
import {PrismaLedgerRepository} from './prisma-ledger.repository';
import {PrismaProgramRepository} from './prisma-program.repository';
import {PrismaTreasuryMessageStore} from './prisma-treasury-message.store';

// Long enough for a row lock to wait behind another writer, short enough that a stuck
// transaction does not hold a program hostage.
const TRANSACTION_TIMEOUT_MS = 15_000;

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (repositories: CapacityRepositories) => Promise<T>): Promise<T> {
    return this.prisma.withClient((client) =>
      client.$transaction(
        (transaction) => {
          const scope = new TransactionScope(transaction);
          return work({
            programs: new PrismaProgramRepository(scope),
            ledger: new PrismaLedgerRepository(scope),
            treasuryMessages: new PrismaTreasuryMessageStore(scope),
          });
        },
        {timeout: TRANSACTION_TIMEOUT_MS},
      ),
    );
  }
}
