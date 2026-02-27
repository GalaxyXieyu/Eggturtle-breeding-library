import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ErrorCode,
  getBreederFamilyTreeResponseSchema,
  getBreederResponseSchema,
  listBreederEventsResponseSchema,
  listBreedersQuerySchema,
  listBreedersResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { BreedersService } from './breeders.service';

@Controller('breeders')
@UseGuards(AuthGuard, RbacGuard)
@RequireTenantRole('VIEWER')
export class BreedersController {
  constructor(private readonly breedersService: BreedersService) {}

  @Get()
  async listBreeders(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listBreedersQuerySchema, query);
    const response = await this.breedersService.listBreeders(tenantId, parsedQuery);

    return listBreedersResponseSchema.parse(response);
  }

  @Get('by-code/:code')
  async getBreederByCode(@Req() request: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const breeder = await this.breedersService.getBreederByCode(tenantId, code);

    return getBreederResponseSchema.parse({ breeder });
  }

  @Get(':id')
  async getBreederById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const breeder = await this.breedersService.getBreederById(tenantId, id);

    return getBreederResponseSchema.parse({ breeder });
  }

  @Get(':id/events')
  async listBreederEvents(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const events = await this.breedersService.listBreederEvents(tenantId, id);

    return listBreederEventsResponseSchema.parse({ events });
  }

  @Get(':id/family-tree')
  async getBreederFamilyTree(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const tree = await this.breedersService.getBreederFamilyTree(tenantId, id);

    return getBreederFamilyTreeResponseSchema.parse({ tree });
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
