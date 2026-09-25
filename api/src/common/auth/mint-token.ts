import {SignJWT} from 'jose';
import {JWT_ALGORITHM} from './jose-token-verifier';

export interface MintTokenOptions {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  /** Becomes `clientId`. Null mints a token without one, for the tests that must refuse it. */
  readonly subject: string | null;
  /** Seconds from now; negative mints an already expired token; null mints one without `exp`. */
  readonly ttlSeconds: number | null;
}

/**
 * Signs a token the way the service verifies it (ADR-0005). Used by `npm run dev:token`, by the
 * e2e helper and, outside production only, by the demo page's `GET /dev/token`. In production
 * the service never mints, it only verifies.
 */
export const mintToken = async (options: MintTokenOptions): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const token = new SignJWT({})
    .setProtectedHeader({alg: JWT_ALGORITHM, typ: 'JWT'})
    .setIssuedAt(now)
    .setIssuer(options.issuer)
    .setAudience(options.audience);
  if (options.subject !== null) token.setSubject(options.subject);
  if (options.ttlSeconds !== null) token.setExpirationTime(now + options.ttlSeconds);
  return token.sign(new TextEncoder().encode(options.secret));
};
