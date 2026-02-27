import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ErrorCode,
  breederCodeSchema,
  breederIdParamSchema,
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
    const parsedCode = this.parseBreederCode(code);
    const breeder = await this.breedersService.getBreederByCode(tenantId, parsedCode);

    return getBreederResponseSchema.parse({ breeder });
  }

  @Get(':id')
  async getBreederById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const breederId = this.parseBreederId(id);
    const breeder = await this.breedersService.getBreederById(tenantId, breederId);

    return getBreederResponseSchema.parse({ breeder });
  }

  @Get(':id/events')
  async listBreederEvents(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const breederId = this.parseBreederId(id);
    const events = await this.breedersService.listBreederEvents(tenantId, breederId);

    return listBreederEventsResponseSchema.parse({ events });
  }

  @Get(':id/family-tree')
  async getBreederFamilyTree(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const breederId = this.parseBreederId(id);
    const tree = await this.breedersService.getBreederFamilyTree(tenantId, breederId);

    return getBreederFamilyTreeResponseSchema.parse({ tree });
  }

  private parseBreederId(id: string): string {
    return parseOrThrow(breederIdParamSchema, id);
  }

  private parseBreederCode(code: string): string {
    return parseOrThrow(breederCodeSchema, code);
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
