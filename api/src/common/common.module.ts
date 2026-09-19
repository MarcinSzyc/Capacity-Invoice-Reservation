import {Global, Module} from '@nestjs/common';
import {JsonLogger} from './logging/json-logger';

@Global()
@Module({
  providers: [JsonLogger],
  exports: [JsonLogger],
})
export class CommonModule {}
