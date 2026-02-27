import type { AuthUser, EffectiveTenantRole } from '@eggturtle/shared';

type AuthHeaders = {
  authorization?: string;
};

export type AuthenticatedRequest = {
  headers: AuthHeaders;
  user?: AuthUser;
  tenantId?: string;
  tenantRole?: EffectiveTenantRole;
};
