import type { AuthUser, EffectiveTenantRole } from '@eggturtle/shared';

type AuthHeaders = {
  authorization?: string;
};

export type AuthenticatedRequest = {
  headers: AuthHeaders;
  method?: string;
  path?: string;
  query?: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  tenantId?: string;
  tenantRole?: EffectiveTenantRole;
};
