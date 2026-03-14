import {
  publicShareQuerySchema,
  publicShareResponseSchema,
  type PublicShareQuery,
  type PublicShareResponse
} from '@eggturtle/shared';

export type PublicSearchParams = Record<string, string | string[] | undefined>;

export type PublicShareAuthQuery = Pick<
  PublicShareQuery,
  'tenantId' | 'resourceType' | 'resourceId' | 'exp' | 'sig'
>;

type ShareRequestParseResult =
  | {
      ok: true;
      shareId: string;
      query: PublicShareAuthQuery;
    }
  | {
      ok: false;
      message: string;
    };

type PublicShareFetchResult =
  | {
      ok: true;
      data: PublicShareResponse;
      shareId: string;
      query: PublicShareAuthQuery;
    }
  | {
      ok: false;
      message: string;
      status?: number;
      errorCode?: string;
    };

// Server-side fetch needs an absolute URL. Prefer INTERNAL_API_BASE_URL for deployments.
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';
const DEFAULT_PUBLIC_SHARE_REVALIDATE_SECONDS = 300;

export async function fetchPublicShareFromSearchParams(
  searchParams: PublicSearchParams,
  options: {
    productId?: string;
  } = {}
): Promise<PublicShareFetchResult> {
  const parsed = parseShareRequest(searchParams);

  if (!parsed.ok) {
    return parsed;
  }

  const response = await fetchPublicShare(parsed.shareId, parsed.query, options);

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    data: response.data,
    shareId: parsed.shareId,
    query: parsed.query
  };
}

export function buildPublicShareRouteQuery(shareId: string, query: PublicShareAuthQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set('sid', shareId);
  params.set('tenantId', query.tenantId);
  params.set('resourceType', query.resourceType);
  params.set('resourceId', query.resourceId);
  params.set('exp', query.exp);
  params.set('sig', query.sig);
  return params;
}

export function appendPublicShareQuery(path: string, shareQuery?: string): string {
  if (!shareQuery) {
    return path;
  }

  const [basePath, hashFragment] = path.split('#', 2);
  const hashSuffix = hashFragment ? `#${hashFragment}` : '';

  return `${basePath}${basePath.includes('?') ? '&' : '?'}${shareQuery}${hashSuffix}`;
}

function parseShareRequest(searchParams: PublicSearchParams): ShareRequestParseResult {
  const sid = firstSearchParamValue(searchParams.sid);

  if (!sid) {
    return {
      ok: false,
      message: '缺少分享标识参数（sid）。'
    };
  }

  const parsedQuery = publicShareQuerySchema.safeParse({
    tenantId: firstSearchParamValue(searchParams.tenantId),
    resourceType: firstSearchParamValue(searchParams.resourceType),
    resourceId: firstSearchParamValue(searchParams.resourceId),
    exp: firstSearchParamValue(searchParams.exp),
    sig: firstSearchParamValue(searchParams.sig)
  });

  if (!parsedQuery.success) {
    return {
      ok: false,
      message: '分享链接无效或已过期。'
    };
  }

  const query: PublicShareAuthQuery = {
    tenantId: parsedQuery.data.tenantId,
    resourceType: parsedQuery.data.resourceType,
    resourceId: parsedQuery.data.resourceId,
    exp: parsedQuery.data.exp,
    sig: parsedQuery.data.sig
  };

  return {
    ok: true,
    shareId: sid,
    query
  };
}

async function fetchPublicShare(
  shareId: string,
  query: PublicShareAuthQuery,
  options: {
    productId?: string;
  }
): Promise<PublicShareFetchResult> {
  const apiBaseUrl =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const requestUrl = new URL(`/shares/${shareId}/public`, apiBaseUrl);
  requestUrl.searchParams.set('tenantId', query.tenantId);
  requestUrl.searchParams.set('resourceType', query.resourceType);
  requestUrl.searchParams.set('resourceId', query.resourceId);
  requestUrl.searchParams.set('exp', query.exp);
  requestUrl.searchParams.set('sig', query.sig);

  if (options.productId) {
    requestUrl.searchParams.set('productId', options.productId);
  }

  const response = await fetch(requestUrl.toString(), {
    next: {
      revalidate: resolvePublicShareRevalidateSeconds(),
    },
  });

  const payload = await safeJson(response);

  if (!response.ok) {
    return {
      ok: false,
      message: pickErrorMessage(payload, response.status),
      status: response.status,
      errorCode: pickErrorCode(payload)
    };
  }

  const parsed = publicShareResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: '分享接口返回结构异常。'
    };
  }

  return {
    ok: true,
    data: parsed.data,
    shareId,
    query
  };
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text
    };
  }
}

function pickErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if (status === 401) {
    return '该分享链接已过期，请重新生成。';
  }

  if (status === 404) {
    return '未找到分享内容。';
  }

  return `Request failed with status ${status}`;
}

function pickErrorCode(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'errorCode' in payload && typeof payload.errorCode === 'string') {
    return payload.errorCode;
  }

  return undefined;
}

export function shouldAutoRefreshShareSignature(status?: number, errorCode?: string): boolean {
  if (status !== 401) {
    return false;
  }

  if (!errorCode) {
    return true;
  }

  return errorCode === 'SHARE_SIGNATURE_EXPIRED' || errorCode === 'SHARE_SIGNATURE_INVALID';
}

function resolvePublicShareRevalidateSeconds(): number {
  const rawValue = process.env.PUBLIC_SHARE_WEB_REVALIDATE_SECONDS;
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PUBLIC_SHARE_REVALIDATE_SECONDS;
  }

  return Math.floor(parsed);
}


export async function refreshPublicShareEntryLocation(
  shareToken: string,
  options: {
    productId?: string | null;
    entrySource?: string | null;
  } = {}
): Promise<string | null> {
  const normalizedShareToken = shareToken.trim();
  if (!normalizedShareToken) {
    return null;
  }

  const apiBaseUrl =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const requestUrl = new URL(`/s/${normalizedShareToken}`, apiBaseUrl);
  const normalizedProductId = options.productId?.trim();
  if (normalizedProductId) {
    requestUrl.searchParams.set('pid', normalizedProductId);
  }

  const normalizedEntrySource = options.entrySource?.trim();
  if (normalizedEntrySource) {
    requestUrl.searchParams.set('src', normalizedEntrySource);
  }

  try {
    const response = await fetch(requestUrl.toString(), {
      cache: 'no-store',
      redirect: 'manual'
    });

    const location = response.headers.get('location');
    if (!location) {
      return null;
    }

    return location;
  } catch {
    return null;
  }
}

export function firstSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
