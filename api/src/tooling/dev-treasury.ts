import {randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {JsonLogger} from '../common/logging/json-logger';
import {KafkaService} from '../messaging/kafka.service';
import {DevTreasuryProducer} from '../modules/capacity/infrastructure/messaging/dev-treasury-producer';

const DEFAULT_BROKERS = 'localhost:9092';
const CAPACITY_UPDATE = 'capacity-update';
const SNAPSHOT = 'snapshot';
const LISTED = /^([^:,]+):([0-9]+)$/;
const INTEGER = /^[0-9]+$/;
// The consumer refuses a zone-less time (A-11), so the producer must not manufacture one.
const WITH_ZONE = /(Z|[+-]\d{2}:\d{2})$/;

const USAGE = `Usage: npm run dev:treasury -- ${CAPACITY_UPDATE} --program <id> --currency <ISO 4217> --limit <minor units>
                                       [--message-id <id>] [--event-time <ISO 8601>]
       npm run dev:treasury -- ${SNAPSHOT} --program <id> --currency <ISO 4217> --limit <minor units>
                                       [--reservations <invoice>:<held>,...] [--message-id <id>] [--as-of <ISO 8601>]

Publishes a treasury message on the local broker (KAFKA_BROKERS, default ${DEFAULT_BROKERS}), so
the real consumer has something to read when no treasury is present (A-05, glossary: dev producer).

Example: npm run dev:treasury -- ${CAPACITY_UPDATE} --program PRG-1 --currency USD --limit 1000000000
Example: npm run dev:treasury -- ${SNAPSHOT} --program PRG-1 --currency USD --limit 1000000000 \\
           --as-of 2026-09-21T18:00:00Z --reservations INV-X:70000000,INV-B:190000000
`;

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value === '') throw new Error(`--${name} is required`);
  return value;
};

const parseInstant = (value: string | undefined, name: string): Date => {
  if (value === undefined) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !WITH_ZONE.test(value)) {
    throw new Error(
      `--${name} must be ISO 8601 with a zone, such as 2026-09-21T10:00:00Z, got "${value}"`,
    );
  }
  return parsed;
};

const parseLimit = (value: string | undefined): bigint => {
  const limit = required(value, 'limit');
  if (!INTEGER.test(limit)) throw new Error(`--limit must be integer minor units, got "${limit}"`);
  return BigInt(limit);
};

/** `INV-A:70000000,INV-B:0`: invoice ids with what each holds, in program minor units. */
const parseReservations = (
  value: string | undefined,
): {invoiceId: string; heldAmount: bigint}[] => {
  if (value === undefined || value === '') return [];
  return value.split(',').map((entry) => {
    const match = LISTED.exec(entry.trim());
    if (match === null) {
      throw new Error(`--reservations entries are <invoice>:<held>, got "${entry}"`);
    }
    return {invoiceId: match[1] ?? '', heldAmount: BigInt(match[2] ?? '0')};
  });
};

const publish = async (
  producer: DevTreasuryProducer,
  type: string,
  values: Record<string, string | boolean | undefined>,
): Promise<Record<string, unknown>> => {
  const text = (name: string): string | undefined => {
    const value = values[name];
    return typeof value === 'string' ? value : undefined;
  };
  const common = {
    messageId: text('message-id') ?? randomUUID(),
    programId: required(text('program'), 'program'),
    currency: required(text('currency'), 'currency'),
    creditLimit: parseLimit(text('limit')),
  };
  if (type === CAPACITY_UPDATE) {
    const update = {...common, eventTime: parseInstant(text('event-time'), 'event-time')};
    await producer.publishCapacityUpdate(update);
    return update;
  }
  const snapshot = {
    ...common,
    asOf: parseInstant(text('as-of'), 'as-of'),
    activeReservations: parseReservations(text('reservations')),
  };
  await producer.publishSnapshot(snapshot);
  return snapshot;
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
      'as-of': {type: 'string'},
      reservations: {type: 'string'},
      help: {type: 'boolean', default: false},
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  const type = positionals[0] ?? '';
  if (type !== CAPACITY_UPDATE && type !== SNAPSHOT) {
    throw new Error(`the message type must be ${CAPACITY_UPDATE} or ${SNAPSHOT}, got "${type}"`);
  }

  const brokers = (process.env.KAFKA_BROKERS ?? DEFAULT_BROKERS).split(',');
  const kafka = new KafkaService({kafkaBrokers: brokers}, new JsonLogger());
  try {
    const published = await publish(new DevTreasuryProducer(kafka), type, values);
    process.stdout.write(`${JSON.stringify({published: type, ...published, brokers}, bigints)}\n`);
  } finally {
    await kafka.onModuleDestroy();
  }
};

/** Minor units are `bigint`; JSON has no such type, so they print as their digits. */
const bigints = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value;

main().catch((reason: unknown) => {
  process.stderr.write(`${reason instanceof Error ? reason.message : String(reason)}\n${USAGE}`);
  process.exit(1);
});
