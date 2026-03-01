import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  ErrorCode,
  aiAssistantQuotaStatusResponseSchema,
  aiAutoRecordIntentRequestSchema,
  aiAutoRecordIntentResponseSchema,
  aiCreateTopUpOrderRequestSchema,
  aiCreateTopUpOrderResponseSchema,
  aiListTopUpPacksResponseSchema,
  aiQueryRequestSchema,
  aiQueryResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import { parseOrThrow } from '../common/zod-parse';

import { AiAssistantService } from './ai-assistant.service';

@Controller('ai-assistant')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
@RequireTenantRole('VIEWER')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get('quota')
  async getQuotaStatus(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const result = await this.aiAssistantService.getQuotaStatus(tenantId);

    return aiAssistantQuotaStatusResponseSchema.parse(result);
  }

  @Get('top-up-packs')
  listTopUpPacks() {
    const result = this.aiAssistantService.listTopUpPacks();

    return aiListTopUpPacksResponseSchema.parse(result);
  }

  @Post('top-up-orders')
  @RequireTenantRole('ADMIN')
  createTopUpOrder(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    this.requireUserId(request.user?.id);
    const payload = parseOrThrow(aiCreateTopUpOrderRequestSchema, body);
    const result = this.aiAssistantService.createTopUpOrder(payload);

    return aiCreateTopUpOrderResponseSchema.parse(result);
  }

  @Post('auto-record/intents')
  @RequireTenantRole('EDITOR')
  parseAutoRecordIntent(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(aiAutoRecordIntentRequestSchema, body);
    const result = this.aiAssistantService.parseAutoRecordIntent(payload);

    return aiAutoRecordIntentResponseSchema.parse(result);
  }

  @Post('query')
  parseQuery(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(aiQueryRequestSchema, body);
    const result = this.aiAssistantService.query(payload);

    return aiQueryResponseSchema.parse(result);
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
    if (!userId) {
      throw new UnauthorizedException({
        message: 'No user found in access token.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    return userId;
  }
}
