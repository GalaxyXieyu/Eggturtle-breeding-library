import {
  getAdminTenantSubscriptionResponseSchema,
  updateTenantSubscriptionRequestSchema,
  updateTenantSubscriptionResponseSchema,
  type UpdateTenantSubscriptionRequest
} from '@eggturtle/shared';

const LOGIN_PATH = '/login';
const AUTH_PROXY_PREFIX = '/api/proxy';

type SchemaParser<T> = {
  parse: (value: unknown) => T;
};

type ApiRequestOptions<RequestPayload, ResponsePayload> = {
  auth?: boolean;
  body?: RequestPayload;
  headers?: HeadersInit;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requestSchema?: SchemaParser<RequestPayload>;
  responseSchema: SchemaParser<ResponsePayload>;
};

export class ApiError extends Error {
  status: number;
  errorCode: string | null;

  constructor(message: string, status: number, errorCode: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export class ApiUnauthorizedError extends ApiError {
  constructor() {
    super('Unauthorized', 401);
    this.name = 'ApiUnauthorizedError';
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}

async function parseJsonBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}

function pickErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('errorCode' in payload && typeof payload.errorCode === 'string') {
    return payload.errorCode;
  }

  return null;
}

function normalizePath(path: string) {
  if (path.startsWith('/')) {
    return path;
  }

  return `/${path}`;
}

function resolveRequestPath(path: string, shouldUseAuth: boolean) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.startsWith('/api/')) {
    return normalizedPath;
  }

  if (shouldUseAuth && normalizedPath.startsWith('/admin/')) {
    return `${AUTH_PROXY_PREFIX}${normalizedPath}`;
  }

  return normalizedPath;
}

export async function apiRequest<RequestPayload = never, ResponsePayload = unknown>(
  path: string,
  options: ApiRequestOptions<RequestPayload, ResponsePayload>
) {
  const shouldUseAuth = options.auth ?? true;
  const headers = new Headers(options.headers ?? {});

  let parsedBody: RequestPayload | undefined;

  if (typeof options.body !== 'undefined') {
    parsedBody = options.requestSchema ? options.requestSchema.parse(options.body) : options.body;
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveRequestPath(path, shouldUseAuth), {
    method: options.method ?? 'GET',
    headers,
    body: typeof parsedBody === 'undefined' ? undefined : JSON.stringify(parsedBody),
    cache: 'no-store'
  });

  const payload = await parseJsonBody(response);

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new ApiError(
      pickErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      pickErrorCode(payload)
    );
  }

  return options.responseSchema.parse(payload);
}

export async function getAdminTenantSubscription(tenantId: string) {
  return apiRequest(`/admin/tenants/${tenantId}/subscription`, {
    responseSchema: getAdminTenantSubscriptionResponseSchema
  });
}

export async function updateAdminTenantSubscription(
  tenantId: string,
  payload: UpdateTenantSubscriptionRequest
) {
  return apiRequest(`/admin/tenants/${tenantId}/subscription`, {
    method: 'PUT',
    body: payload,
    requestSchema: updateTenantSubscriptionRequestSchema,
    responseSchema: updateTenantSubscriptionResponseSchema
  });
}
