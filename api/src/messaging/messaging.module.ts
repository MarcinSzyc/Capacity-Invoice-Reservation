import {Module} from '@nestjs/common';
import {KafkaService} from './kafka.service';
import {MESSAGE_SOURCE} from './message-source';

@Module({
  providers: [KafkaService, {provide: MESSAGE_SOURCE, useExisting: KafkaService}],
  exports: [KafkaService, MESSAGE_SOURCE],
})
export class MessagingModule {}
