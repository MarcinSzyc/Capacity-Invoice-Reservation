import {ConfigurationError, DEV_JWT_SECRET, loadConfig} from './configuration';

const COMPLETE_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://capacity:capacity@localhost:5432/capacity',
  KAFKA_BROKERS: 'localhost:9092',
  WEB_ORIGIN: 'http://localhost:8080',
  JWT_SECRET: 'a-secret-long-enough-for-hs256-in-tests',
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
      reconciliationKeepWindowSeconds: 30,
      jwt: {
        secret: COMPLETE_ENV.JWT_SECRET,
        issuer: 'capacity-dev',
        audience: 'capacity-api',
      },
    });
  });

  it('should require the JWT secret, because a service that cannot verify a token must not start (ADR-0005)', () => {
    const {JWT_SECRET: _removed, ...withoutSecret} = COMPLETE_ENV;

    expect(() => loadConfig(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('should refuse the well known development secret in the production profile', () => {
    expect(() =>
      loadConfig({...COMPLETE_ENV, NODE_ENV: 'production', JWT_SECRET: DEV_JWT_SECRET}),
    ).toThrow(/JWT_SECRET/);
    expect(loadConfig({...COMPLETE_ENV, JWT_SECRET: DEV_JWT_SECRET}).jwt.secret).toBe(
      DEV_JWT_SECRET,
    );
  });

  it('should read issuer and audience when they are set', () => {
    const config = loadConfig({
      ...COMPLETE_ENV,
      JWT_ISSUER: 'treasury-idp',
      JWT_AUDIENCE: 'ledger',
    });

    expect(config.jwt).toMatchObject({issuer: 'treasury-idp', audience: 'ledger'});
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

  it('should reject a port above the highest one a machine has', () => {
    expect(() => loadConfig({...COMPLETE_ENV, PORT: '99999'})).toThrow(/PORT/);
  });

  it('should reject an empty web origin rather than pass it to CORS', () => {
    expect(() => loadConfig({...COMPLETE_ENV, WEB_ORIGIN: '   '})).toThrow(/WEB_ORIGIN/);
  });

  it('should default the profile to development and the port to 3000', () => {
    const {NODE_ENV: _profile, PORT: _port, ...withoutOptionals} = COMPLETE_ENV;

    const config = loadConfig(withoutOptionals);

    expect(config.profile).toBe('development');
    expect(config.port).toBe(3000);
  });

  it('should read the reconciliation keep window, 30 seconds unless set (ADR-0010)', () => {
    expect(
      loadConfig({...COMPLETE_ENV, RECONCILIATION_KEEP_WINDOW_SECONDS: '0'})
        .reconciliationKeepWindowSeconds,
    ).toBe(0);
    expect(
      loadConfig({...COMPLETE_ENV, RECONCILIATION_KEEP_WINDOW_SECONDS: '120'})
        .reconciliationKeepWindowSeconds,
    ).toBe(120);
  });

  it('should reject a keep window that is not a whole number of seconds', () => {
    expect(() => loadConfig({...COMPLETE_ENV, RECONCILIATION_KEEP_WINDOW_SECONDS: '-1'})).toThrow(
      /RECONCILIATION_KEEP_WINDOW_SECONDS/,
    );
    expect(() => loadConfig({...COMPLETE_ENV, RECONCILIATION_KEEP_WINDOW_SECONDS: '1.5'})).toThrow(
      /RECONCILIATION_KEEP_WINDOW_SECONDS/,
    );
  });

  it('should split a comma separated broker list', () => {
    const config = loadConfig({...COMPLETE_ENV, KAFKA_BROKERS: 'one:9092, two:9092'});

    expect(config.kafkaBrokers).toEqual(['one:9092', 'two:9092']);
  });
});
