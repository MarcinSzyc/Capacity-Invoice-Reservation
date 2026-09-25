import {Inject, Injectable} from '@nestjs/common';
import {MESSAGE_SOURCE, MessageSource} from '../../../../messaging/message-source';
import {CAPACITY_UPDATE_TYPE} from '../../application/apply-capacity-update.use-case';
import {RECONCILIATION_SNAPSHOT_TYPE} from '../../application/apply-reconciliation-snapshot.use-case';
import {jsonInteger} from '../../../../common/json-integer';
import {TREASURY_TOPIC} from './treasury-topics';

export interface CapacityUpdateToPublish {
  readonly messageId: string;
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly eventTime: Date;
}

export interface SnapshotToPublish {
  readonly messageId: string;
  readonly programId: string;
  readonly currency: string;
  readonly creditLimit: bigint;
  readonly asOf: Date;
  readonly activeReservations: readonly {readonly invoiceId: string; readonly heldAmount: bigint}[];
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

  /** A-11: the program's full state as of one moment, the list in program currency. */
  publishSnapshot(snapshot: SnapshotToPublish): Promise<void> {
    const payload = {
      messageId: snapshot.messageId,
      type: RECONCILIATION_SNAPSHOT_TYPE,
      programId: snapshot.programId,
      currency: snapshot.currency,
      creditLimit: jsonInteger(snapshot.creditLimit, 'creditLimit'),
      asOf: snapshot.asOf.toISOString(),
      activeReservations: snapshot.activeReservations.map((listed) => ({
        invoiceId: listed.invoiceId,
        heldAmount: jsonInteger(listed.heldAmount, 'heldAmount'),
      })),
    };
    return this.source.publish(TREASURY_TOPIC, [
      {key: snapshot.programId, value: JSON.stringify(payload)},
    ]);
  }
}
