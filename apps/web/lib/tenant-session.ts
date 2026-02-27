import {
  currentTenantResponseSchema,
  myTenantsResponseSchema,
  switchTenantRequestSchema,
  switchTenantResponseSchema
} from '@eggturtle/shared';

import { ApiError, apiRequest, setAccessToken } from './api-client';

export async function switchTenantBySlug(slug: string) {
  const response = await apiRequest('/auth/switch-tenant', {
    method: 'POST',
    body: { slug },
    requestSchema: switchTenantRequestSchema,
    responseSchema: switchTenantResponseSchema
  });

  setAccessToken(response.accessToken);

  return response;
}

export async function resolveCurrentTenantSlug() {
  try {
    const currentTenant = await apiRequest('/tenants/current', {
      responseSchema: currentTenantResponseSchema
    });

    return currentTenant.tenant.slug;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 400) {
      throw error;
    }
  }

  const memberships = await apiRequest('/tenants/me', {
    responseSchema: myTenantsResponseSchema
  });

  const defaultTenant = memberships.tenants[0];
  if (!defaultTenant) {
    return null;
  }

  const switched = await switchTenantBySlug(defaultTenant.tenant.slug);
  return switched.tenant.slug;
}
