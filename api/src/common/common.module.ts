import {Global, Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {JoseTokenVerifier} from './auth/jose-token-verifier';
import {JwtAuthGuard} from './auth/jwt-auth.guard';
import {TOKEN_VERIFIER} from './auth/token-verifier';
import {JsonLogger} from './logging/json-logger';

@Global()
@Module({
  providers: [
    JsonLogger,
    {provide: TOKEN_VERIFIER, useClass: JoseTokenVerifier},
    // ADR-0005: every route is guarded unless it says @Public().
    {provide: APP_GUARD, useClass: JwtAuthGuard},
  ],
  exports: [JsonLogger, TOKEN_VERIFIER],
})
export class CommonModule {}
