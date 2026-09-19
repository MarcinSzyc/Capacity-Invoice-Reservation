import {ConfigurationError, loadConfig} from './configuration';

const COMPLETE_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://capacity:capacity@localhost:5432/capacity',
  KAFKA_BROKERS: 'localhost:9092',
  WEB_ORIGIN: 'http://localhost:8080',
};

describe('loadConfig', () => {
  it('should read a complete environment into a typed configuration', () => {
    const config = loadConfig(COMPLETE_ENV);

    expect(config).toEqual({
      profile: 'test',
      port: 3000,
      databaseUrl: COMPLETE_ENV.DATABASE_URL,
      kafkaBrokers: ['localhost:9092'],
      webOrigin: 'http://localhost:8080',
    });
  });

  it('should fail fast and name the variable when a required one is missing', () => {
    const {DATABASE_URL: _removed, ...withoutDatabaseUrl} = COMPLETE_ENV;

    expect(() => loadConfig(withoutDatabaseUrl)).toThrow(ConfigurationError);
    expect(() => loadConfig(withoutDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it('should list every missing variable in one message', () => {
    expect(() => loadConfig({})).toThrow(
      /DATABASE_URL.*KAFKA_BROKERS|KAFKA_BROKERS.*DATABASE_URL/s,
    );
  });

  it('should reject a profile that is not development, test or production', () => {
    expect(() => loadConfig({...COMPLETE_ENV, NODE_ENV: 'staging'})).toThrow(/NODE_ENV/);
  });

  it('should reject a port that is not a positive integer', () => {
    expect(() => loadConfig({...COMPLETE_ENV, PORT: 'http'})).toThrow(/PORT/);
  });

  it('should default the profile to development and the port to 3000', () => {
    const {NODE_ENV: _profile, PORT: _port, ...withoutOptionals} = COMPLETE_ENV;

    const config = loadConfig(withoutOptionals);

    expect(config.profile).toBe('development');
    expect(config.port).toBe(3000);
  });

  it('should split a comma separated broker list', () => {
    const config = loadConfig({...COMPLETE_ENV, KAFKA_BROKERS: 'one:9092, two:9092'});

    expect(config.kafkaBrokers).toEqual(['one:9092', 'two:9092']);
  });
});
