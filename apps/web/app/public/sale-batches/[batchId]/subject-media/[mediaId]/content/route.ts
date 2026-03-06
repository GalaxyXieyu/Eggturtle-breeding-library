import { NextRequest } from 'next/server';

import { proxyPublicAsset } from '@/lib/public-asset-proxy';

type RouteContext = {
  params: {
    batchId: string;
    mediaId: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPublicAsset(
    `/public/sale-batches/${context.params.batchId}/subject-media/${context.params.mediaId}/content`,
    request.nextUrl.search
  );
}
