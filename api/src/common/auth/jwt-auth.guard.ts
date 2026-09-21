import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import type {Request} from 'express';
import {IS_PUBLIC} from './public.decorator';
import {InvalidTokenError, TOKEN_VERIFIER, TokenVerifier} from './token-verifier';

const BEARER_PREFIX = /^Bearer\s+(?<token>\S+)$/i;

/** The request, once a token has been accepted. Controllers read `clientId` from here (AC-34). */
export interface AuthenticatedRequest extends Request {
  clientId: string;
}

/**
 * ADR-0005: one global guard. A missing, malformed, expired or wrongly signed token is 401 with
 * the standard envelope and nothing in the body about why (AC-32, AC-33).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.header('authorization'));
    if (token === undefined) throw new UnauthorizedException();

    try {
      const claims = await this.verifier.verify(token);
      request.clientId = claims.clientId;
      return true;
    } catch (reason: unknown) {
      if (reason instanceof InvalidTokenError) throw new UnauthorizedException();
      throw reason;
    }
  }
}

const bearerToken = (header: string | undefined): string | undefined =>
  header === undefined ? undefined : BEARER_PREFIX.exec(header)?.groups?.token;
