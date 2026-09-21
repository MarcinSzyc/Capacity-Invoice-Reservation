import {InvalidTokenError} from './token-verifier';
import {JoseTokenVerifier} from './jose-token-verifier';
import {mintToken} from './mint-token';

const JWT = {
  secret: 'the-secret-the-service-verifies-with',
  issuer: 'capacity-dev',
  audience: 'capacity-api',
};
const OTHER_SECRET = 'a-secret-nobody-configured-the-service-with';
const CLIENT = 'client-42';
const ONE_HOUR_S = 3_600;

// A token without an expiry, unsigned: the shape of the classic `alg: none` attack.
const unsignedToken = (claims: Record<string, unknown>): string => {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg: 'none', typ: 'JWT'})}.${encode(claims)}.`;
};

describe('JoseTokenVerifier', () => {
  const verifier = new JoseTokenVerifier({jwt: JWT});

  it('should accept a token minted with the configured secret and hand back its subject as the client id', async () => {
    const token = await mintToken({...JWT, subject: CLIENT, ttlSeconds: ONE_HOUR_S});

    await expect(verifier.verify(token)).resolves.toEqual({clientId: CLIENT});
  });

  it('should reject a token that has expired', async () => {
    const token = await mintToken({...JWT, subject: CLIENT, ttlSeconds: -ONE_HOUR_S});

    await expect(verifier.verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject a token signed with another secret', async () => {
    const token = await mintToken({
      ...JWT,
      secret: OTHER_SECRET,
      subject: CLIENT,
      ttlSeconds: ONE_HOUR_S,
    });

    await expect(verifier.verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject an unsigned token whatever its header claims about the algorithm', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedToken({
      sub: CLIENT,
      iss: JWT.issuer,
      aud: JWT.audience,
      exp: now + ONE_HOUR_S,
    });

    await expect(verifier.verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject a token without an expiry rather than treat it as eternal', async () => {
    const token = await mintToken({...JWT, subject: CLIENT, ttlSeconds: null});

    await expect(verifier.verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject a token without a subject, because every movement needs a client id (AC-34)', async () => {
    const token = await mintToken({...JWT, subject: null, ttlSeconds: ONE_HOUR_S});

    await expect(verifier.verify(token)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject a token issued for another issuer or audience', async () => {
    const otherIssuer = await mintToken({
      ...JWT,
      issuer: 'someone-else',
      subject: CLIENT,
      ttlSeconds: ONE_HOUR_S,
    });
    const otherAudience = await mintToken({
      ...JWT,
      audience: 'another-api',
      subject: CLIENT,
      ttlSeconds: ONE_HOUR_S,
    });

    await expect(verifier.verify(otherIssuer)).rejects.toThrow(InvalidTokenError);
    await expect(verifier.verify(otherAudience)).rejects.toThrow(InvalidTokenError);
  });

  it('should reject something that is not a token at all', async () => {
    await expect(verifier.verify('not-a-token')).rejects.toThrow(InvalidTokenError);
  });
});
