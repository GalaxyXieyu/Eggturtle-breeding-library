const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;

export type PublicImageMaxEdge = 320 | 480 | 960;

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
    if (isAbsolute) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    if (!isLikelyResizablePublicAssetUrl(normalized)) {
      return normalized;
    }

    const joiner = normalized.includes('?') ? '&' : '?';
    return `${normalized}${joiner}maxEdge=${maxEdge}`;
  }
}
