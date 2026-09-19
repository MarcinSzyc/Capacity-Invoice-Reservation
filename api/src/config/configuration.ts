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
    webOrigin: env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN,
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
  return Number.parseInt(value, 10);
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
  return raw
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker !== '');
};
