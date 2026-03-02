import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ErrorCode,
  getTenantSharePresentationResponseSchema,
  uploadTenantSharePresentationImageResponseSchema,
  updateTenantSharePresentationRequestSchema,
  updateTenantSharePresentationResponseSchema
} from '@eggturtle/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { parseOrThrow } from '../common/zod-parse';

import { TenantSharePresentationService } from './tenant-share-presentation.service';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller('tenant-share-presentation')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
@RequireTenantRole('VIEWER')
export class TenantSharePresentationController {
  constructor(private readonly tenantSharePresentationService: TenantSharePresentationService) {}

  @Get()
  async getTenantPresentation(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const presentation = await this.tenantSharePresentationService.getTenantTemplate(tenantId);

    return getTenantSharePresentationResponseSchema.parse({
      presentation
    });
  }

  @Put()
  @RequireTenantRole('EDITOR')
  async updateTenantPresentation(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(updateTenantSharePresentationRequestSchema, body);

    const presentation = await this.tenantSharePresentationService.upsertTenantTemplate(
      tenantId,
      payload.presentation
    );

    return updateTenantSharePresentationResponseSchema.parse({
      presentation
    });
  }

  @Post('images')
  @RequireTenantRole('EDITOR')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  async uploadImage(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedBinaryFile | undefined
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A single image file is required in form field "file".');
    }

    const asset = await this.tenantSharePresentationService.uploadImage(tenantId, actorUserId, file);
    return uploadTenantSharePresentationImageResponseSchema.parse({ asset });
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    return tenantId;
  }

  private requireUserId(userId?: string): string {
    const normalized = userId?.trim();
    if (!normalized) {
      throw new BadRequestException('No authenticated user found.');
    }

    return normalized;
  }
}
