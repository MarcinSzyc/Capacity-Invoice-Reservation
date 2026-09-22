import {Inject, Injectable} from '@nestjs/common';
import {MESSAGE_SOURCE, MessageSource} from '../../../../messaging/message-source';
import {CAPACITY_UPDATE_TYPE} from '../../application/apply-capacity-update.use-case';
import {jsonInteger} from '../../../../common/json-integer';
import {TREASURY_TOPIC} from './treasury-topics';

export interface CapacityUpdateToPublish {
  readonly messageId: string;
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly eventTime: Date;
}

/**
 * The dev producer (glossary): publishes treasury-shaped messages on the local broker so the
 * real consumer has something to read when no treasury is present. Used by the seed command,
 * the tests and, from S-07, the web treasury panel. Not registered in production.
 */
@Injectable()
export class DevTreasuryProducer {
  constructor(@Inject(MESSAGE_SOURCE) private readonly source: MessageSource) {}

  publishCapacityUpdate(update: CapacityUpdateToPublish): Promise<void> {
    const payload = {
      messageId: update.messageId,
      type: CAPACITY_UPDATE_TYPE,
      programId: update.programId,
      currency: update.currency,
      creditLimit: jsonInteger(update.creditLimit, 'creditLimit'),
      eventTime: update.eventTime.toISOString(),
    };
    return this.source.publish(TREASURY_TOPIC, [
      {key: update.programId, value: JSON.stringify(payload)},
    ]);
  }
}
