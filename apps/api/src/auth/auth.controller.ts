import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ErrorCode,
  createWechatAuthorizeUrlRequestSchema,
  createWechatAuthorizeUrlResponseSchema,
  passwordLoginRequestSchema,
  passwordLoginResponseSchema,
  phoneLoginRequestSchema,
  phoneLoginResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  requestSmsCodeRequestSchema,
  requestSmsCodeResponseSchema,
  switchTenantRequestSchema,
  switchTenantResponseSchema,
  verifyCodeRequestSchema,
  verifyCodeResponseSchema,
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';

import { AuthIdentityService } from './auth-identity.service';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { RbacGuard } from './rbac.guard';
import { RequireTenantRole } from './require-tenant-role.decorator';
import { WechatAuthService } from './wechat-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authIdentityService: AuthIdentityService,
    private readonly wechatAuthService: WechatAuthService,
  ) {}

  @Post('request-code')
  async requestCode(@Body() body: unknown, @Headers('x-eggturtle-auth-surface') surface?: string) {
    const payload = parseOrThrow(requestCodeRequestSchema, body);
    const response = await this.authIdentityService.requestCode(payload.email, surface);

    return requestCodeResponseSchema.parse(response);
  }

  @Post('request-sms-code')
  async requestSmsCode(@Body() body: unknown, @Headers('x-eggturtle-auth-surface') surface?: string) {
    const payload = parseOrThrow(requestSmsCodeRequestSchema, body);
    const response = await this.authIdentityService.requestSmsCode(
      payload.phoneNumber,
      payload.purpose,
      surface,
    );

    return requestSmsCodeResponseSchema.parse(response);
  }

  @Post('verify-code')
  async verifyCode(@Body() body: unknown, @Headers('x-eggturtle-auth-surface') surface?: string) {
    const payload = parseOrThrow(verifyCodeRequestSchema, body);
    const response = await this.authIdentityService.verifyCode(
      payload.email,
      payload.code,
      payload.password,
      surface,
    );

    return verifyCodeResponseSchema.parse(response);
  }

  @Post('password-login')
  async passwordLogin(@Body() body: unknown, @Headers('x-eggturtle-auth-surface') surface?: string) {
    const payload = parseOrThrow(passwordLoginRequestSchema, body);
    const response = await this.authIdentityService.passwordLogin(payload.login, payload.password, surface);

    return passwordLoginResponseSchema.parse(response);
  }

  @Post('phone-login')
  async phoneLogin(@Body() body: unknown, @Headers('x-eggturtle-auth-surface') surface?: string) {
    const payload = parseOrThrow(phoneLoginRequestSchema, body);
    const response = await this.authIdentityService.phoneLogin(payload.phoneNumber, payload.code, surface);

    return phoneLoginResponseSchema.parse(response);
  }

  @Post('switch-tenant')
  @UseGuards(AuthGuard)
  async switchTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(switchTenantRequestSchema, body);
    const response = await this.authIdentityService.switchTenant(user, payload);

    return switchTenantResponseSchema.parse(response);
  }

  @Post('register')
  async register(@Body() body: unknown) {
    const payload = parseOrThrow(registerRequestSchema, body);
    const response = await this.authIdentityService.register(payload);

    return registerResponseSchema.parse(response);
  }

  @Post('wechat/authorize-url')
  @UseGuards(AuthGuard, RbacGuard)
  @RequireTenantRole('ADMIN')
  createWechatAuthorizeUrl(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(createWechatAuthorizeUrlRequestSchema, body);
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected,
      });
    }

    const response = this.wechatAuthService.createAuthorizeUrl(user.id, tenantId, payload.returnPath);
    return createWechatAuthorizeUrlResponseSchema.parse(response);
  }

  @Get('wechat/callback')
  async handleWechatCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('returnPath') returnPath: string | undefined,
    @Res() response: { redirect: (statusCode: number, url: string) => void },
  ) {
    const redirectUrl = await this.wechatAuthService.handleCallback({
      code,
      state,
      returnPath,
    });

    response.redirect(302, redirectUrl);
  }
}
