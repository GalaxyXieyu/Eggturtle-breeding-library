import type { ShareResourceType } from '@eggturtle/shared';

export type PublicShareQueryInput = {
  tenantId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  productId?: string;
  exp: string;
  sig: string;
};

export type PublicShareAssetQueryInput = PublicShareQueryInput & {
  key: string;
  maxEdge?: number;
};

export type ShareAccessMeta = {
  ip: string | null;
  userAgent: string | null;
};

export type ShareAuditScope = {
  id: string;
  tenantId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  productId: string | null;
  createdByUserId: string;
  shareToken?: string;
};

export type ShareScope = ShareAuditScope & {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
};
