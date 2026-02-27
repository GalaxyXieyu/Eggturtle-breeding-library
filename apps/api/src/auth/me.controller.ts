import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { meResponseSchema } from '@eggturtle/shared';

import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedRequest } from './auth.types';

@Controller()
export class MeController {
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Req() request: AuthenticatedRequest
  ) {
    return meResponseSchema.parse({
      user,
      tenantId: request.tenantId ?? null
    });
  }
}
