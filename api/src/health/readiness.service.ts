import {Injectable} from '@nestjs/common';
import {KafkaService} from '../messaging/kafka.service';
import {PrismaService} from '../persistence/prisma.service';
import {ProbeState, ReadinessDto} from './health.dto';

const state = (reachable: boolean): ProbeState => (reachable ? 'up' : 'down');

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  async check(): Promise<ReadinessDto> {
    const [database, broker] = await Promise.all([
      this.prisma.isReachable(),
      this.kafka.isReachable(),
    ]);
    const checks = {database: state(database), broker: state(broker)};

    return {status: database && broker ? 'ok' : 'degraded', checks};
  }
}
