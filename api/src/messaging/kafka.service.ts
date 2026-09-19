import {Inject, Injectable, OnModuleDestroy} from '@nestjs/common';
import {Admin, Kafka, logLevel} from 'kafkajs';
import {APP_CONFIG, AppConfig} from '../config/config.module';

export const CONSUMER_GROUP = 'capacity-service';

/**
 * S-01 only needs to know that the broker answers, for readiness. S-02 adds the consumer of
 * `treasury.capacity` behind the TreasuryMessageSource port (ADR-0003).
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly admin: Admin;
  private connected = false;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.admin = new Kafka({
      clientId: CONSUMER_GROUP,
      brokers: [...config.kafkaBrokers],
      logLevel: logLevel.NOTHING,
    }).admin();
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.connect();
      await this.admin.listTopics();
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    await this.admin.disconnect();
    this.connected = false;
  }

  private async connect(): Promise<void> {
    if (this.connected) return;
    await this.admin.connect();
    this.connected = true;
  }
}
