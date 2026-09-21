import {parseArgs} from 'node:util';
import {mintToken} from '../common/auth/mint-token';
import {DEFAULT_JWT_AUDIENCE, DEFAULT_JWT_ISSUER, DEV_JWT_SECRET} from '../config/configuration';

const DEFAULT_SUBJECT = 'demo-client';
const DEFAULT_TTL = '8h';
const TTL_PATTERN = /^(?<amount>[1-9][0-9]*)(?<unit>[smhd])?$/;
const SECONDS_PER_UNIT: Readonly<Record<string, number>> = {s: 1, m: 60, h: 3_600, d: 86_400};

const USAGE = `Usage: npm run dev:token -- [--sub <clientId>] [--ttl <duration>]

Mints a bearer token the local api accepts (AC-37, ADR-0005). Signs with JWT_SECRET, or with the
development secret compose starts the api with when JWT_SECRET is not set.

  --sub   the client id the token carries, default ${DEFAULT_SUBJECT}
  --ttl   how long it is valid, such as 30m, 8h or 2d, default ${DEFAULT_TTL}
`;

const parseTtl = (value: string): number => {
  const match = TTL_PATTERN.exec(value);
  const amount = match?.groups?.amount;
  if (match === null || amount === undefined) {
    throw new Error(`--ttl must look like 30m, 8h or 2d, got "${value}"`);
  }
  return Number.parseInt(amount, 10) * (SECONDS_PER_UNIT[match.groups?.unit ?? 's'] ?? 1);
};

const main = async (): Promise<void> => {
  const {values} = parseArgs({
    options: {
      sub: {type: 'string', default: DEFAULT_SUBJECT},
      ttl: {type: 'string', default: DEFAULT_TTL},
      help: {type: 'boolean', default: false},
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  const token = await mintToken({
    secret: process.env.JWT_SECRET ?? DEV_JWT_SECRET,
    issuer: process.env.JWT_ISSUER ?? DEFAULT_JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
    subject: values.sub,
    ttlSeconds: parseTtl(values.ttl),
  });
  process.stdout.write(`${token}\n`);
};

main().catch((reason: unknown) => {
  process.stderr.write(`${reason instanceof Error ? reason.message : String(reason)}\n${USAGE}`);
  process.exit(1);
});
