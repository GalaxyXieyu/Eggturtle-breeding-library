import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ErrorCode, healthDbResponseSchema, healthResponseSchema } from '@eggturtle/shared';

import { PrismaService } from './prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      errorCode: ErrorCode.None
    });
  }

  @Get('health/db')
  async getDbHealth() {
    const isProduction = process.env.NODE_ENV === 'production';

    try {
      const [users, tenants, tenantMembers] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.tenant.count(),
        this.prisma.tenantMember.count()
      ]);

      return healthDbResponseSchema.parse({
        status: 'ok',
        database: 'postgres',
        errorCode: ErrorCode.None,
        ...(isProduction
          ? {}
          : {
              counts: {
                users,
                tenants,
                tenantMembers
              }
            })
      });
    } catch {
      throw new ServiceUnavailableException(
        healthDbResponseSchema.parse({
          status: 'degraded',
          database: 'postgres',
          errorCode: ErrorCode.ApiUnavailable
        })
      );
    }
  }
}
