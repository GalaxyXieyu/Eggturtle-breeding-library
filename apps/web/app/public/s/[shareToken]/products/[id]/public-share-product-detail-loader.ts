import type { PublicShareMerchantWatermark, PublicSharePresentation } from '@eggturtle/shared';
import { redirect } from 'next/navigation';

import {
  mapPublicShareDetail,
  mapPublicProductToLegacyBreeder,
  mapTenantFeedToLegacy
} from '@/app/public/_public-product/public-share-adapter';
import type {
  Breeder,
  BreederEventItem,
  FamilyTree,
  MaleMateLoadItem,
  Series
} from '@/app/public/_public-product/types';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams
} from '@/app/public/_shared/public-share-api';

export type PublicShareProductDetailViewModel = {
  breeder: Breeder | null;
  series: Series | null;
  events: BreederEventItem[];
  familyTree: FamilyTree | null;
  maleMateLoad: MaleMateLoadItem[];
  fallbackBreeders: Breeder[];
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  breederId: string;
  homeHref?: string;
  tenantSlug?: string;
  tenantName?: string;
  presentation?: PublicSharePresentation | null;
  merchantWatermark?: PublicShareMerchantWatermark | null;
};

export type PublicShareProductDetailLoadResult =
  | {
      ok: true;
      data: PublicShareProductDetailViewModel;
    }
  | {
      ok: false;
      title: string;
      message: string;
    };

export async function loadPublicShareProductDetail(
  params: { shareToken: string; id: string },
  searchParams: PublicSearchParams
): Promise<PublicShareProductDetailLoadResult> {
  const sidValue = firstSearchParamValue(searchParams.sid);
  const hasSidParam = typeof sidValue === 'string' && sidValue.trim().length > 0;
  const entrySource = firstSearchParamValue(searchParams.src)?.trim();
  if (!hasSidParam) {
    const location = await refreshPublicShareEntryLocation(params.shareToken, {
      productId: params.id,
      entrySource
    });
    if (location) {
      redirect(location);
    }
  }

  const shareResult = await fetchPublicShareFromSearchParams(searchParams, {
    productId: params.id
  });

  if (!shareResult.ok) {
    if (shouldAutoRefreshShareSignature(shareResult.status, shareResult.errorCode)) {
      const location = await refreshPublicShareEntryLocation(params.shareToken, {
        productId: params.id,
        entrySource
      });
      if (location) {
        redirect(location);
      }
    }

    return {
      ok: false,
      title: '公开详情不可用',
      message: shareResult.message
    };
  }

  if (shareResult.data.resourceType !== 'tenant_feed') {
    return {
      ok: false,
      title: '公开详情不可用',
      message: '该链接不是用户图鉴分享链接。'
    };
  }

  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const seriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (seriesId) {
    shareRouteQuery.set('series', seriesId);
  }

  const shareQuery = shareRouteQuery.toString();
  const legacyFeedData = mapTenantFeedToLegacy(shareResult.data);
  const detailData = mapPublicShareDetail(shareResult.data);
  const detailBreeder = shareResult.data.product
    ? mapPublicProductToLegacyBreeder(shareResult.data.product)
    : null;
  const series = detailBreeder
    ? legacyFeedData.series.find((item) => item.id === detailBreeder.seriesId) || null
    : null;

  return {
    ok: true,
    data: {
      breeder: detailBreeder,
      breederId: params.id,
      series,
      events: detailData.events,
      familyTree: detailData.familyTree,
      maleMateLoad: detailData.maleMateLoad,
      fallbackBreeders: legacyFeedData.breeders.slice(0, 4),
      demo: false,
      shareToken: params.shareToken,
      shareQuery,
      homeHref: `/public/s/${params.shareToken}`,
      tenantSlug: shareResult.data.tenant.slug,
      tenantName: shareResult.data.tenant.name,
      presentation: shareResult.data.presentation,
      merchantWatermark: shareResult.data.merchantWatermark,
    }
  };
}
