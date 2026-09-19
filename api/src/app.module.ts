import {Module} from '@nestjs/common';
import {CommonModule} from './common/common.module';
import {ConfigModule} from './config/config.module';
import {HealthModule} from './health/health.module';
import {MessagingModule} from './messaging/messaging.module';
import {PersistenceModule} from './persistence/persistence.module';

@Module({
  imports: [ConfigModule, CommonModule, PersistenceModule, MessagingModule, HealthModule],
})
export class AppModule {}
