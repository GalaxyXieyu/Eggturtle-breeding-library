import {
  createShareRequestSchema,
  createShareResponseSchema,
  meResponseSchema,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

export type TenantShareIntent = 'feed' | 'series' | { productId: string };

type CreateTenantFeedShareLinkOptions = {
  tenantId?: string | null;
  intent?: TenantShareIntent;
  missingTenantMessage?: string;
};

export type TenantFeedShareLink = {
  tenantId: string;
  shareToken: string;
  entryUrl: string;
  permanentUrl: string;
};

export async function createTenantFeedShareLink(
  options: CreateTenantFeedShareLinkOptions = {},
): Promise<TenantFeedShareLink> {
  const tenantId = await resolveTenantId(options.tenantId, options.missingTenantMessage);

  const payload = createShareRequestSchema.parse({
    resourceType: 'tenant_feed',
    resourceId: tenantId,
  });

  const response = await apiRequest('/shares', {
    method: 'POST',
    body: payload,
    requestSchema: createShareRequestSchema,
    responseSchema: createShareResponseSchema,
  });

  return {
    tenantId,
    shareToken: response.share.shareToken,
    entryUrl: response.share.entryUrl,
    permanentUrl: buildTenantSharePermanentUrl(response.share.shareToken, options.intent),
  };
}

export function buildTenantSharePermanentUrl(shareToken: string, intent: TenantShareIntent = 'feed') {
  const pathSuffix = buildSharePath(intent);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/public/s/${shareToken}${pathSuffix}`;
  }

  return `/public/s/${shareToken}${pathSuffix}`;
}

async function resolveTenantId(rawTenantId: string | null | undefined, missingTenantMessage?: string) {
  const providedTenantId = rawTenantId?.trim();
  if (providedTenantId) {
    return providedTenantId;
  }

  const meResponse = await apiRequest('/me', {
    responseSchema: meResponseSchema,
  });

  const tenantId = meResponse.tenantId?.trim();
  if (tenantId) {
    return tenantId;
  }

  throw new Error(missingTenantMessage ?? '当前租户上下文未就绪，暂时无法生成链接。');
}

function buildSharePath(intent: TenantShareIntent): string {
  if (intent === 'feed') {
    return '';
  }

  if (intent === 'series') {
    return '/series';
  }

  return `/products/${intent.productId}`;
}
