import {Module} from '@nestjs/common';
import {MessagingModule} from '../../messaging/messaging.module';
import {PersistenceModule} from '../../persistence/persistence.module';
import {PrismaService} from '../../persistence/prisma.service';
import {ResetState} from './application/reset-state.use-case';
import {STATE_RESET} from './domain/ports/state-reset';
import {CapacityModule} from './capacity.module';
import {DevController} from './infrastructure/http/dev.controller';
import {DevTreasuryProducer} from './infrastructure/messaging/dev-treasury-producer';
import {PrismaStateReset} from './infrastructure/persistence/prisma-state-reset';

/**
 * The demo page's side of `api` (A-17, AC-38): dev endpoints only, no business rule. Imported
 * only outside the production profile, so in production none of its routes exist.
 */
@Module({
  imports: [CapacityModule, MessagingModule, PersistenceModule],
  controllers: [DevController],
  providers: [
    DevTreasuryProducer,
    ResetState,
    {
      provide: STATE_RESET,
      useFactory: (prisma: PrismaService) => new PrismaStateReset(prisma),
      inject: [PrismaService],
    },
  ],
})
export class CapacityDevModule {}
