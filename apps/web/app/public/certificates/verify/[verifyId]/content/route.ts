import { NextRequest } from 'next/server';

import { proxyPublicAsset } from '../../../../../../lib/public-asset-proxy';

type RouteContext = {
  params: {
    verifyId: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPublicAsset(`/public/certificates/verify/${context.params.verifyId}/content`, request.nextUrl.search);
}
