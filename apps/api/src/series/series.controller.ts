import { BadRequestException, Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  ErrorCode,
  getSeriesResponseSchema,
  listSeriesQuerySchema,
  listSeriesResponseSchema,
  updateSeriesRequestSchema,
  updateSeriesResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { SeriesService } from './series.service';

@Controller('series')
@UseGuards(AuthGuard, RbacGuard)
@RequireTenantRole('VIEWER')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  async listSeries(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listSeriesQuerySchema, query);
    const response = await this.seriesService.listSeries(tenantId, parsedQuery);

    return listSeriesResponseSchema.parse(response);
  }

  @Get(':id')
  async getSeries(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const series = await this.seriesService.getSeriesById(tenantId, id);

    return getSeriesResponseSchema.parse({ series });
  }

  @Put(':id')
  @RequireTenantRole('EDITOR')
  async updateSeries(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(updateSeriesRequestSchema, body);
    const series = await this.seriesService.updateSeries(tenantId, id, payload);

    return updateSeriesResponseSchema.parse({ series });
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
}
