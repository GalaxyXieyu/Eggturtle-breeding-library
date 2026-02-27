import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  switchTenantRequestSchema,
  switchTenantResponseSchema,
  verifyCodeRequestSchema,
  verifyCodeResponseSchema
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';

import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  async requestCode(@Body() body: unknown) {
    const payload = parseOrThrow(requestCodeRequestSchema, body);
    const response = await this.authService.requestCode(payload.email);

    return requestCodeResponseSchema.parse(response);
  }

  @Post('verify-code')
  async verifyCode(@Body() body: unknown) {
    const payload = parseOrThrow(verifyCodeRequestSchema, body);
    const response = await this.authService.verifyCode(payload.email, payload.code);

    return verifyCodeResponseSchema.parse(response);
  }

  @Post('switch-tenant')
  @UseGuards(AuthGuard)
  async switchTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(switchTenantRequestSchema, body);
    const response = await this.authService.switchTenant(user, payload);

    return switchTenantResponseSchema.parse(response);
  }
}
