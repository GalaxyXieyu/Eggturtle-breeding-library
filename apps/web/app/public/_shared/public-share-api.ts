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
    };

const DEFAULT_API_BASE_URL = 'http://localhost:30011';

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

function parseShareRequest(searchParams: PublicSearchParams): ShareRequestParseResult {
  const sid = firstValue(searchParams.sid);

  if (!sid) {
    return {
      ok: false,
      message: '缺少分享标识参数（sid）。'
    };
  }

  const parsedQuery = publicShareQuerySchema.safeParse({
    tenantId: firstValue(searchParams.tenantId),
    resourceType: firstValue(searchParams.resourceType),
    resourceId: firstValue(searchParams.resourceId),
    exp: firstValue(searchParams.exp),
    sig: firstValue(searchParams.sig)
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
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
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
    cache: 'no-store'
  });

  const payload = await safeJson(response);

  if (!response.ok) {
    return {
      ok: false,
      message: pickErrorMessage(payload, response.status)
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

function firstValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
