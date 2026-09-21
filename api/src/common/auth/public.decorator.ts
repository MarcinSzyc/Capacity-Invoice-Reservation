import {SetMetadata} from '@nestjs/common';

export const IS_PUBLIC = Symbol('isPublic');

/**
 * Marks a route that answers without a token: liveness, readiness and, from S-07, the dev-only
 * endpoints the demo page uses (A-16, INV-10). Everything else is guarded by default, so a route
 * added without thinking about authentication is a guarded route.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
