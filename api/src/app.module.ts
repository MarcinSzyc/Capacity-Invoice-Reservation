import {Module} from '@nestjs/common';
import {CommonModule} from './common/common.module';
import {ConfigModule} from './config/config.module';
import {HealthModule} from './health/health.module';
import {CapacityModule} from './modules/capacity/capacity.module';

@Module({
  imports: [ConfigModule, CommonModule, HealthModule, CapacityModule],
})
export class AppModule {}
