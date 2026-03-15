import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  deleteMyAvatarResponseSchema,
  ErrorCode,
  meProfileResponseSchema,
  myPhoneBindingResponseSchema,
  mySecurityProfileResponseSchema,
  meResponseSchema,
  meSubscriptionResponseSchema,
  uploadMyAvatarResponseSchema,
  upsertMyPhoneBindingRequestSchema,
  upsertMyPhoneBindingResponseSchema,
  upsertMySecurityProfileRequestSchema,
  upsertMySecurityProfileResponseSchema,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema,
} from '@eggturtle/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { parseOrThrow } from '../common/zod-parse';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { AuthGuard } from './auth.guard';
import { AuthProfileService } from './auth-profile.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedRequest } from './auth.types';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller()
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly authProfileService: AuthProfileService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
  ) {}

  @Get('me')
  getMe(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Req() request: AuthenticatedRequest,
  ) {
    return meResponseSchema.parse({
      user,
      tenantId: request.tenantId ?? null,
    });
  }

  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const profile = await this.authProfileService.getMyProfile(user.id);
    return meProfileResponseSchema.parse({ profile });
  }

  @Put('me/profile')
  async updateMyProfile(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(updateMeProfileRequestSchema, body);
    const profile = await this.authProfileService.updateMyProfile(user.id, payload);
    return updateMeProfileResponseSchema.parse({ profile });
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadMyAvatar(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @UploadedFile() file: UploadedBinaryFile | undefined,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A single image file is required in form field "file".');
    }

    const profile = await this.authProfileService.uploadMyAvatar(user.id, file);
    return uploadMyAvatarResponseSchema.parse({ profile });
  }

  @Delete('me/avatar')
  async deleteMyAvatar(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const profile = await this.authProfileService.deleteMyAvatar(user.id);
    return deleteMyAvatarResponseSchema.parse({ profile });
  }

  @Put('me/password')
  async updateMyPassword(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(updateMyPasswordRequestSchema, body);
    const response = await this.authProfileService.updateMyPassword(user.id, payload);
    return updateMyPasswordResponseSchema.parse({
      ok: true,
      passwordUpdatedAt: response.passwordUpdatedAt,
    });
  }

  @Get('me/security-profile')
  async getMySecurityProfile(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const profile = await this.authProfileService.getMySecurityProfile(user.id);
    return mySecurityProfileResponseSchema.parse({ profile });
  }

  @Put('me/security-profile')
  async upsertMySecurityProfile(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(upsertMySecurityProfileRequestSchema, body);
    const response = await this.authProfileService.upsertMySecurityProfile(user.id, payload);
    return upsertMySecurityProfileResponseSchema.parse({
      ok: true,
      updatedAt: response.updatedAt,
    });
  }

  @Get('me/phone-binding')
  async getMyPhoneBinding(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const binding = await this.authProfileService.getMyPhoneBinding(user.id);
    return myPhoneBindingResponseSchema.parse({ binding });
  }

  @Put('me/phone-binding')
  async upsertMyPhoneBinding(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(upsertMyPhoneBindingRequestSchema, body);
    const response = await this.authProfileService.upsertMyPhoneBinding(user.id, payload);
    return upsertMyPhoneBindingResponseSchema.parse({
      ok: true,
      binding: response,
    });
  }

  @Get('me/subscription')
  async getMyTenantSubscription(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(tenantId);
    return meSubscriptionResponseSchema.parse({ subscription });
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected,
      });
    }

    return tenantId;
  }
}
