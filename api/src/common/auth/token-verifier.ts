export const TOKEN_VERIFIER = Symbol('TokenVerifier');

/** What the guard needs from a token: who is calling. The subject becomes `clientId` (A-14). */
export interface TokenClaims {
  readonly clientId: string;
}

/** Any reason a token is not accepted. The caller learns 401 and nothing more (AC-32, AC-33). */
export class InvalidTokenError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

/**
 * ADR-0005: the library that verifies tokens sits behind this port, so switching from a shared
 * secret to a key set changes one adapter and no module.
 */
export interface TokenVerifier {
  verify(token: string): Promise<TokenClaims>;
}
