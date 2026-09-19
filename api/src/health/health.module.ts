import {Module} from '@nestjs/common';
import {MessagingModule} from '../messaging/messaging.module';
import {PersistenceModule} from '../persistence/persistence.module';
import {HealthController} from './health.controller';
import {ReadinessService} from './readiness.service';

@Module({
  imports: [PersistenceModule, MessagingModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class HealthModule {}
