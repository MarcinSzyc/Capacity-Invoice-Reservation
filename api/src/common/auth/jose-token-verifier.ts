import {Inject, Injectable} from '@nestjs/common';
import {jwtVerify} from 'jose';
import {APP_CONFIG, AppConfig} from '../../config/config.module';
import {InvalidTokenError, TokenClaims, TokenVerifier} from './token-verifier';

/** Pinned: what the token's header says about its algorithm is never trusted (ADR-0005). */
export const JWT_ALGORITHM = 'HS256';

@Injectable()
export class JoseTokenVerifier implements TokenVerifier {
  private readonly key: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(@Inject(APP_CONFIG) {jwt}: Pick<AppConfig, 'jwt'>) {
    this.key = new TextEncoder().encode(jwt.secret);
    this.issuer = jwt.issuer;
    this.audience = jwt.audience;
  }

  async verify(token: string): Promise<TokenClaims> {
    let subject: string | undefined;
    let expiry: number | undefined;
    try {
      const {payload} = await jwtVerify(token, this.key, {
        algorithms: [JWT_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
      });
      subject = payload.sub;
      expiry = payload.exp;
    } catch (reason: unknown) {
      throw new InvalidTokenError(reason instanceof Error ? reason.message : String(reason));
    }

    if (expiry === undefined) throw new InvalidTokenError('"exp" claim is required');
    if (subject === undefined || subject === '') {
      throw new InvalidTokenError('"sub" claim is required');
    }
    return {clientId: subject};
  }
}
