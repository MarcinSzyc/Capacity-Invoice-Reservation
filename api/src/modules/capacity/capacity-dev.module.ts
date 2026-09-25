import {Module} from '@nestjs/common';
import {MessagingModule} from '../../messaging/messaging.module';
import {CapacityModule} from './capacity.module';
import {DevController} from './infrastructure/http/dev.controller';
import {DevTreasuryProducer} from './infrastructure/messaging/dev-treasury-producer';

/**
 * The demo page's side of `api` (A-17, AC-38): dev endpoints only, no business rule. Imported
 * only outside the production profile, so in production none of its routes exist.
 */
@Module({
  imports: [CapacityModule, MessagingModule],
  controllers: [DevController],
  providers: [DevTreasuryProducer],
})
export class CapacityDevModule {}
