import {Global, Module} from '@nestjs/common';
import {loadConfig} from './configuration';

export const APP_CONFIG = 'APP_CONFIG';

export type {AppConfig} from './configuration';

@Global()
@Module({
  providers: [{provide: APP_CONFIG, useFactory: () => loadConfig(process.env)}],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
