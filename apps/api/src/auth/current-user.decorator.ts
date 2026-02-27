import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';

import type { AuthenticatedRequest } from './auth.types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

  if (!request.user) {
    throw new UnauthorizedException({
      message: 'Unauthenticated.',
      errorCode: ErrorCode.Unauthorized
    });
  }

  return request.user;
});
