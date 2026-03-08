import {
  createShareRequestSchema,
  createShareResponseSchema,
  meResponseSchema,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

export type TenantShareIntent = 'feed' | 'series' | { productId: string };

export type TenantSharePosterVariant = 'generic' | 'detail';

export type TenantShareDialogCopy = {
  title: string;
  subtitle: string;
  body: string;
  hint: string;
};

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
  const intent = normalizeTenantShareIntent(options.intent);
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
    permanentUrl: buildTenantSharePermanentUrl(response.share.shareToken, intent),
  };
}

export function buildTenantSharePermanentUrl(
  shareToken: string,
  intent: TenantShareIntent = 'feed',
) {
  const pathSuffix = buildSharePath(intent);
  const publicShareOrigin = resolvePublicShareOrigin();

  return `${publicShareOrigin}/public/s/${shareToken}${pathSuffix}`;
}

export function normalizeTenantShareIntent(
  intent: TenantShareIntent | null | undefined,
): TenantShareIntent {
  if (!intent || intent === 'feed' || intent === 'series') {
    return intent ?? 'feed';
  }

  const productId = intent.productId.trim();
  if (!productId) {
    return 'feed';
  }

  return { productId };
}

export function getTenantShareIntentKey(intent: TenantShareIntent | null | undefined): string {
  const normalizedIntent = normalizeTenantShareIntent(intent);
  if (normalizedIntent === 'feed' || normalizedIntent === 'series') {
    return normalizedIntent;
  }

  return `product:${normalizedIntent.productId}`;
}

export function getTenantShareDialogCopy(
  intent: TenantShareIntent | null | undefined,
): TenantShareDialogCopy {
  const normalizedIntent = normalizeTenantShareIntent(intent);

  if (normalizedIntent === 'series') {
    return {
      title: '系列公开页分享',
      subtitle: '扫码查看当前系列公开页，或复制链接直接转发。',
      body: '系列页会打开对应公开系列视图，适合给访客快速浏览这一组产品。',
      hint: '系列海报、二维码和链接共用同一条公开分享链路。',
    };
  }

  if (typeof normalizedIntent === 'object') {
    return {
      title: '种龟公开详情分享',
      subtitle: '扫码查看当前种龟公开详情页，或复制链接直接转发。',
      body: '访客会直接落到当前种龟详情，不需要再从公开页二次查找。',
      hint: '当前种龟详情、二维码和海报预览共用同一条公开分享链路。',
    };
  }

  return {
    title: '蛋龟选育库分享',
    subtitle: '扫码查看公开页面，或复制链接直接转发。',
    body: '访客会打开公开瀑布流页面，适合直接分享整库入口。',
    hint: '公开页、二维码和海报预览共用同一条公开分享链路。',
  };
}

function resolvePublicShareOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_PUBLIC_APP_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
}

async function resolveTenantId(
  rawTenantId: string | null | undefined,
  missingTenantMessage?: string,
) {
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
  const normalizedIntent = normalizeTenantShareIntent(intent);

  if (normalizedIntent === 'feed') {
    return '';
  }

  if (normalizedIntent === 'series') {
    return '/series';
  }

  return `/products/${encodeURIComponent(normalizedIntent.productId)}`;
}
