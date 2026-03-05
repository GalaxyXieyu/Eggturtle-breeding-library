import { ApiError, getAccessToken } from './api-client';
import { switchTenantBySlug } from './tenant-session';

type RouterLike = {
  replace: (href: string) => void;
};

type EnsureTenantRouteSessionOptions = {
  tenantSlug: string;
  missingTenantMessage: string;
  router?: RouterLike;
  redirectWhenUnauthenticated?: boolean;
  redirectWhenTenantMismatch?: boolean;
};

type EnsureTenantRouteSessionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: 'missing-tenant' | 'unauthenticated' | 'tenant-mismatch';
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
    redirectWhenTenantMismatch = true,
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

  try {
    await switchTenantBySlug(tenantSlug);
    return { ok: true };
  } catch (error) {
    if (isTenantMismatchError(error)) {
      if (redirectWhenTenantMismatch) {
        router?.replace('/app');
      }

      return {
        ok: false,
        reason: 'tenant-mismatch',
        message: '当前空间不可用，正在切换到你的可用工作台。'
      };
    }

    throw error;
  }
}

function isTenantMismatchError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 403 || error.status === 404;
  }

  if (error instanceof Error) {
    return (
      error.message.includes('User is not a member of this tenant.') ||
      error.message.includes('Tenant not found.')
    );
  }

  return false;
}
