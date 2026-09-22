import {createParamDecorator, ExecutionContext} from '@nestjs/common';
import type {AuthenticatedRequest} from './jwt-auth.guard';

/** The token's subject, as the guard left it on the request (A-14); recorded on movements (INV-09). */
export const ClientId = (): ParameterDecorator =>
  createParamDecorator(
    (_data: unknown, context: ExecutionContext): string =>
      context.switchToHttp().getRequest<AuthenticatedRequest>().clientId,
  )();
