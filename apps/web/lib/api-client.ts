const TOKEN_STORAGE_KEY = 'eggturtle.accessToken';

// Default to same-origin (relative paths) so production doesn't accidentally call
// the *device* localhost when NEXT_PUBLIC_API_BASE_URL is missing.
const DEFAULT_API_BASE_URL = '';

const LOGIN_PATH = '/login';
const PRODUCT_IMAGE_CONTENT_PATH_PATTERN = /^\/products\/[^/]+\/images\/[^/]+\/content$/;

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

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function getAccessToken() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function resolveAuthenticatedAssetUrl(rawValue: string) {
  const value = rawValue.trim();

  if (!value) {
    return value;
  }

  if (value.startsWith('/images/')) {
    return value;
  }

  const apiBaseUrl = getApiBaseUrl();
  const candidate = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith('/products/')
      ? `${apiBaseUrl}${value}`
      : value;

  const isHttpCandidate = /^https?:\/\//i.test(candidate);

  let parsed: URL;
  try {
    if (isHttpCandidate) {
      parsed = new URL(candidate);
    } else if (typeof window !== 'undefined') {
      parsed = new URL(candidate, window.location.origin);
    } else {
      return candidate;
    }
  } catch {
    return candidate;
  }

  // If the API base is absolute, enforce same-origin before attaching accessToken.
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    const apiOrigin = new URL(apiBaseUrl).origin;
    if (parsed.origin !== apiOrigin) {
      return candidate;
    }
  }

  if (!PRODUCT_IMAGE_CONTENT_PATH_PATTERN.test(parsed.pathname)) {
    return candidate;
  }

  const token = getAccessToken();
  if (!token) {
    return candidate;
  }

  if (!parsed.searchParams.has('accessToken')) {
    parsed.searchParams.set('accessToken', token);
  }

  // Preserve relative URLs when the input was relative.
  if (!isHttpCandidate) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  return parsed.toString();
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ApiUnauthorizedError extends ApiError {
  constructor() {
    super('Unauthorized', 401);
    this.name = 'ApiUnauthorizedError';
  }
}

function redirectToLogin() {
  if (!canUseStorage()) {
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

  if (shouldUseAuth && !headers.has('Authorization')) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: typeof parsedBody === 'undefined' ? undefined : JSON.stringify(parsedBody),
    cache: 'no-store'
  });

  const payload = await parseJsonBody(response);

  if (response.status === 401) {
    clearAccessToken();
    redirectToLogin();
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new ApiError(
      pickErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status
    );
  }

  return options.responseSchema.parse(payload);
}
