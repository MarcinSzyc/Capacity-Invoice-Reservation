export type Profile = 'development' | 'test' | 'production';

export interface AppConfig {
  readonly profile: Profile;
  readonly port: number;
  readonly databaseUrl: string;
  readonly kafkaBrokers: readonly string[];
  readonly webOrigin: string;
}

export class ConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Configuration is invalid: ${problems.join('; ')}`);
    this.name = 'ConfigurationError';
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

const PROFILES: readonly Profile[] = ['development', 'test', 'production'];
const DEFAULT_PROFILE: Profile = 'development';
const DEFAULT_PORT = 3000;
const DEFAULT_WEB_ORIGIN = 'http://localhost:8080';
const PORT_PATTERN = /^[1-9][0-9]*$/;
const HIGHEST_PORT = 65_535;

/**
 * Boot reads the environment once, here. Anything missing or malformed is collected and thrown
 * together, so a misconfigured deployment fails on start with the full list instead of one
 * variable per restart.
 */
export const loadConfig = (env: Environment): AppConfig => {
  const problems: string[] = [];
  const config: AppConfig = {
    profile: readProfile(env.NODE_ENV, problems),
    port: readPort(env.PORT, problems),
    databaseUrl: readRequired(env.DATABASE_URL, 'DATABASE_URL', problems),
    kafkaBrokers: readBrokers(env.KAFKA_BROKERS, problems),
    webOrigin: readWebOrigin(env.WEB_ORIGIN, problems),
  };

  if (problems.length > 0) throw new ConfigurationError(problems);
  return config;
};

const readProfile = (value: string | undefined, problems: string[]): Profile => {
  if (value === undefined) return DEFAULT_PROFILE;

  const profile = PROFILES.find((candidate) => candidate === value);
  if (profile === undefined) {
    problems.push(`NODE_ENV must be one of ${PROFILES.join(', ')}, got "${value}"`);
    return DEFAULT_PROFILE;
  }
  return profile;
};

const readPort = (value: string | undefined, problems: string[]): number => {
  if (value === undefined) return DEFAULT_PORT;
  if (!PORT_PATTERN.test(value)) {
    problems.push(`PORT must be a positive integer, got "${value}"`);
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);
  if (port > HIGHEST_PORT) {
    problems.push(`PORT must be at most ${HIGHEST_PORT}, got "${value}"`);
    return DEFAULT_PORT;
  }
  return port;
};

const readWebOrigin = (value: string | undefined, problems: string[]): string => {
  if (value === undefined) return DEFAULT_WEB_ORIGIN;
  if (value.trim() === '') {
    problems.push('WEB_ORIGIN must not be blank');
    return DEFAULT_WEB_ORIGIN;
  }
  return value;
};

const readRequired = (value: string | undefined, name: string, problems: string[]): string => {
  if (value === undefined || value.trim() === '') {
    problems.push(`${name} is required`);
    return '';
  }
  return value;
};

const readBrokers = (value: string | undefined, problems: string[]): readonly string[] => {
  const raw = readRequired(value, 'KAFKA_BROKERS', problems);
  const brokers = raw
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker !== '');

  if (raw !== '' && brokers.length === 0) problems.push('KAFKA_BROKERS lists no broker');
  return brokers;
};
