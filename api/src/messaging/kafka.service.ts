import {Inject, Injectable, OnModuleDestroy} from '@nestjs/common';
import {Admin, Kafka, LogEntry, logLevel} from 'kafkajs';
import {JsonLogger} from '../common/logging/json-logger';
import {APP_CONFIG, AppConfig} from '../config/config.module';

// Names this connection in the broker's logs. The consumer group S-02 subscribes with is a
// different thing and arrives with the consumer (ADR-0003).
export const CLIENT_ID = 'capacity-service';

/**
 * S-01 only needs to know that the broker answers, for readiness. S-02 adds the consumer of
 * `treasury.capacity` behind the TreasuryMessageSource port (ADR-0003).
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly admin: Admin;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly logger: JsonLogger,
  ) {
    this.admin = new Kafka({
      clientId: CLIENT_ID,
      brokers: [...config.kafkaBrokers],
      // Errors go through our logger, so a readiness probe reporting `broker: down` leaves the
      // cause in the logs (A-18). Anything below a warning is kafkajs chatter we do not want.
      logLevel: logLevel.WARN,
      logCreator: () => (entry) => this.writeBrokerLog(entry),
    }).admin();
  }

  async isReachable(): Promise<boolean> {
    try {
      // kafkajs connect() is idempotent and owns its own state. Tracking it here as well went
      // wrong whenever a probe timed out: the stale continuation could flip the flag back.
      await this.admin.connect();
      await this.admin.listTopics();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      // Unconditional: a probe may have timed out while connect() was still retrying, and that
      // loop keeps the process alive until the admin is closed.
      await this.admin.disconnect();
    } catch {
      // Shutting down. A broker that never answered has nothing worth reporting here.
    }
  }

  private writeBrokerLog({level, log}: LogEntry): void {
    const message = `kafka: ${log.message}`;
    if (level === logLevel.ERROR) {
      this.logger.error(message, undefined, CLIENT_ID);
      return;
    }
    this.logger.warn(message, CLIENT_ID);
  }
}
