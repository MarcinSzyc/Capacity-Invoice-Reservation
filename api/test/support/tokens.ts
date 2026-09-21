import {mintToken} from '../../src/common/auth/mint-token';
import type {AppConfig} from '../../src/config/config.module';
import {loadConfig} from '../../src/config/configuration';

export const TEST_CLIENT_ID = 'client-e2e';
const ONE_HOUR_S = 3_600;
const WRONG_SECRET = 'not-the-secret-the-service-was-started-with';

const jwtOf = (config?: AppConfig): AppConfig['jwt'] => (config ?? loadConfig(process.env)).jwt;

/** ADR-0005: the e2e helper mints in-process with the test secret. */
export const validToken = (
  clientId: string = TEST_CLIENT_ID,
  config?: AppConfig,
): Promise<string> => mintToken({...jwtOf(config), subject: clientId, ttlSeconds: ONE_HOUR_S});

export const expiredToken = (config?: AppConfig): Promise<string> =>
  mintToken({...jwtOf(config), subject: TEST_CLIENT_ID, ttlSeconds: -ONE_HOUR_S});

export const wronglySignedToken = (config?: AppConfig): Promise<string> =>
  mintToken({
    ...jwtOf(config),
    secret: WRONG_SECRET,
    subject: TEST_CLIENT_ID,
    ttlSeconds: ONE_HOUR_S,
  });

export const bearer = (token: string): string => `Bearer ${token}`;
