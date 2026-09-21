import {randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {JsonLogger} from '../common/logging/json-logger';
import {KafkaService} from '../messaging/kafka.service';
import {DevTreasuryProducer} from '../modules/capacity/infrastructure/messaging/dev-treasury-producer';

const DEFAULT_BROKERS = 'localhost:9092';
const CAPACITY_UPDATE = 'capacity-update';
const INTEGER = /^[0-9]+$/;
// The consumer refuses a zone-less time (A-11), so the producer must not manufacture one.
const WITH_ZONE = /(Z|[+-]\d{2}:\d{2})$/;

const USAGE = `Usage: npm run dev:treasury -- ${CAPACITY_UPDATE} --program <id> --currency <ISO 4217> --limit <minor units>
                                       [--message-id <id>] [--event-time <ISO 8601>]

Publishes a treasury message on the local broker (KAFKA_BROKERS, default ${DEFAULT_BROKERS}), so
the real consumer has something to read when no treasury is present (A-05, glossary: dev producer).

Example: npm run dev:treasury -- ${CAPACITY_UPDATE} --program PRG-1 --currency USD --limit 1000000000
`;

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value === '') throw new Error(`--${name} is required`);
  return value;
};

const parseEventTime = (value: string | undefined): Date => {
  if (value === undefined) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !WITH_ZONE.test(value)) {
    throw new Error(
      `--event-time must be ISO 8601 with a zone, such as 2026-09-21T10:00:00Z, got "${value}"`,
    );
  }
  return parsed;
};

const main = async (): Promise<void> => {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
      program: {type: 'string'},
      currency: {type: 'string'},
      limit: {type: 'string'},
      'message-id': {type: 'string'},
      'event-time': {type: 'string'},
      help: {type: 'boolean', default: false},
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (positionals[0] !== CAPACITY_UPDATE) {
    throw new Error(`the only message type so far is ${CAPACITY_UPDATE}`);
  }
  const limit = required(values.limit, 'limit');
  if (!INTEGER.test(limit)) throw new Error(`--limit must be integer minor units, got "${limit}"`);
  const eventTime = parseEventTime(values['event-time']);

  const brokers = (process.env.KAFKA_BROKERS ?? DEFAULT_BROKERS).split(',');
  const kafka = new KafkaService({kafkaBrokers: brokers}, new JsonLogger());
  const update = {
    messageId: values['message-id'] ?? randomUUID(),
    programId: required(values.program, 'program'),
    currency: required(values.currency, 'currency'),
    creditLimit: BigInt(limit),
    eventTime,
  };
  try {
    await new DevTreasuryProducer(kafka).publishCapacityUpdate(update);
    process.stdout.write(
      `${JSON.stringify({published: CAPACITY_UPDATE, ...update, creditLimit: limit, brokers})}\n`,
    );
  } finally {
    await kafka.onModuleDestroy();
  }
};

main().catch((reason: unknown) => {
  process.stderr.write(`${reason instanceof Error ? reason.message : String(reason)}\n${USAGE}`);
  process.exit(1);
});
