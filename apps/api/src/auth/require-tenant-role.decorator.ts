import { SetMetadata } from '@nestjs/common';
import type { TenantRole } from '@eggturtle/shared';

import { MINIMUM_TENANT_ROLE_KEY } from './rbac.constants';

export const RequireTenantRole = (minimumRole: TenantRole) =>
  SetMetadata(MINIMUM_TENANT_ROLE_KEY, minimumRole);
