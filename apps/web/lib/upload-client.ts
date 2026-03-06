import { ApiError, getAccessToken, getApiBaseUrl } from '@/lib/api-client';

type ResponseSchemaParser<T> = {
  parse: (value: unknown) => T;
};

export async function uploadSingleFileWithAuth<T>(
  path: string,
  file: File,
  responseSchema: ResponseSchemaParser<T>,
) {
  const token = getAccessToken();
  const headers = new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  const payload = await parseJsonBody(response);
  if (!response.ok) {
    throw new ApiError(
      pickErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
    );
  }

  return responseSchema.parse(payload);
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
