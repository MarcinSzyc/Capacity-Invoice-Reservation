import {DynamicModule, Module} from '@nestjs/common';
import {CommonModule} from './common/common.module';
import {ConfigModule} from './config/config.module';
import type {Profile} from './config/configuration';
import {HealthModule} from './health/health.module';
import {CapacityDevModule} from './modules/capacity/capacity-dev.module';
import {CapacityModule} from './modules/capacity/capacity.module';

/**
 * The module graph for one profile. Chosen before the graph is built rather than guarded at
 * request time, so in production the dev endpoints are not registered at all (AC-38, local
 * decision 1 of S-07).
 */
@Module({})
export class AppModule {
  static forProfile(profile: Profile): DynamicModule {
    const devOnly = profile === 'production' ? [] : [CapacityDevModule];
    return {
      module: AppModule,
      imports: [ConfigModule, CommonModule, HealthModule, CapacityModule, ...devOnly],
    };
  }
}
