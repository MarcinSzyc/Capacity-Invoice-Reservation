import {Module} from '@nestjs/common';
import {MessagingModule} from '../../messaging/messaging.module';
import {PersistenceModule} from '../../persistence/persistence.module';
import {PrismaService} from '../../persistence/prisma.service';
import {ApplyCapacityUpdate} from './application/apply-capacity-update.use-case';
import {GetAvailability} from './application/get-availability.query';
import {GetReservation} from './application/get-reservation.query';
import {ReleaseCapacity} from './application/release-capacity.use-case';
import {RejectTreasuryMessage} from './application/reject-treasury-message.use-case';
import {ReserveCapacity} from './application/reserve-capacity.use-case';
import {CLOCK} from './domain/ports/clock';
import {PROGRAM_REPOSITORY} from './domain/ports/program.repository';
import {UNIT_OF_WORK} from './domain/ports/unit-of-work';
import {ProgramsController} from './infrastructure/http/programs.controller';
import {TreasuryCapacityConsumer} from './infrastructure/messaging/treasury-capacity.consumer';
import {PrismaProgramRepository} from './infrastructure/persistence/prisma-program.repository';
import {PrismaUnitOfWork} from './infrastructure/persistence/prisma-unit-of-work';
import {SystemClock} from './infrastructure/system-clock';

/**
 * Programs, reservations and the ledger in one module: they share one transaction boundary.
 * Splitting later is a refactor, not a plan change (slice S-02).
 */
@Module({
  imports: [PersistenceModule, MessagingModule],
  controllers: [ProgramsController],
  providers: [
    {provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork},
    {provide: CLOCK, useClass: SystemClock},
    {
      provide: PROGRAM_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaProgramRepository(prisma),
      inject: [PrismaService],
    },
    ApplyCapacityUpdate,
    RejectTreasuryMessage,
    ReserveCapacity,
    ReleaseCapacity,
    GetAvailability,
    GetReservation,
    TreasuryCapacityConsumer,
  ],
})
export class CapacityModule {}
