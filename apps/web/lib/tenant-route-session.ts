import { getAccessToken } from './api-client';
import { switchTenantBySlug } from './tenant-session';

type RouterLike = {
  replace: (href: string) => void;
};

type EnsureTenantRouteSessionOptions = {
  tenantSlug: string;
  missingTenantMessage: string;
  router?: RouterLike;
  redirectWhenUnauthenticated?: boolean;
};

type EnsureTenantRouteSessionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: 'missing-tenant' | 'unauthenticated';
      message?: string;
    };

export async function ensureTenantRouteSession(
  options: EnsureTenantRouteSessionOptions,
): Promise<EnsureTenantRouteSessionResult> {
  const {
    tenantSlug,
    missingTenantMessage,
    router,
    redirectWhenUnauthenticated = true,
  } = options;

  if (!tenantSlug) {
    return {
      ok: false,
      reason: 'missing-tenant',
      message: missingTenantMessage,
    };
  }

  if (!getAccessToken()) {
    if (redirectWhenUnauthenticated) {
      router?.replace('/login');
    }

    return {
      ok: false,
      reason: 'unauthenticated',
    };
  }

  await switchTenantBySlug(tenantSlug);
  return { ok: true };
}
