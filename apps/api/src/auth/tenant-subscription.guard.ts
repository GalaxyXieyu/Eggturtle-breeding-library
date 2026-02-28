import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from './auth.types';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class TenantSubscriptionGuard implements CanActivate {
  constructor(private readonly tenantSubscriptionsService: TenantSubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { method?: string }>();
    const tenantId = request.tenantId;

    if (!tenantId) {
      return true;
    }

    const method = (request.method ?? 'GET').toUpperCase();
    if (!WRITE_METHODS.has(method)) {
      return true;
    }

    await this.tenantSubscriptionsService.assertTenantWritable(tenantId);
    return true;
  }
}
