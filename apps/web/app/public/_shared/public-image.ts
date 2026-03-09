const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const PUBLIC_ASSET_BASE_URL = normalizePublicAssetBaseUrl(process.env.NEXT_PUBLIC_PUBLIC_ASSET_BASE_URL);

export type PublicImageMaxEdge = 320 | 480 | 640 | 960 | 1200;

function normalizePublicAssetBaseUrl(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function withPublicAssetBase(url: string): string {
  if (!PUBLIC_ASSET_BASE_URL) {
    return url;
  }

  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${PUBLIC_ASSET_BASE_URL}${normalized}`;
}

function isResizablePublicAssetPath(pathname: string): boolean {
  if (pathname === '/tenant-share-presentation/assets') {
    return true;
  }

  return pathname.startsWith('/shares/') && pathname.includes('/public/assets');
}

function isLikelyResizablePublicAssetUrl(url: string): boolean {
  if (url.includes('/tenant-share-presentation/assets')) {
    return true;
  }

  return url.includes('/shares/') && url.includes('/public/assets');
}

export function withPublicImageMaxEdge(
  url: string | null | undefined,
  maxEdge: PublicImageMaxEdge
): string | null | undefined {
  if (typeof url !== 'string') {
    return url;
  }

  const normalized = url.trim();
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return url;
  }

  try {
    const isAbsolute = ABSOLUTE_URL_PATTERN.test(normalized);
    const parsed = new URL(normalized, 'http://localhost');

    if (!isResizablePublicAssetPath(parsed.pathname)) {
      return normalized;
    }

    parsed.searchParams.set('maxEdge', String(maxEdge));
    const rewritten = isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;

    return isAbsolute ? rewritten : withPublicAssetBase(rewritten);
  } catch {
    if (!isLikelyResizablePublicAssetUrl(normalized)) {
      return normalized;
    }

    const joiner = normalized.includes('?') ? '&' : '?';
    const rewritten = `${normalized}${joiner}maxEdge=${maxEdge}`;
    return ABSOLUTE_URL_PATTERN.test(rewritten) ? rewritten : withPublicAssetBase(rewritten);
  }
}
