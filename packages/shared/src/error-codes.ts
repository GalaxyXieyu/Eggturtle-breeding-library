export const ErrorCode = {
  None: 'NONE',
  ApiUnavailable: 'API_UNAVAILABLE',
  InvalidRequestPayload: 'INVALID_REQUEST_PAYLOAD',
  InvalidCode: 'INVALID_CODE',
  ExpiredCode: 'EXPIRED_CODE',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  TenantNotFound: 'TENANT_NOT_FOUND',
  NotTenantMember: 'NOT_TENANT_MEMBER',
  TenantSlugConflict: 'TENANT_SLUG_CONFLICT',
  TenantNotSelected: 'TENANT_NOT_SELECTED',
  ProductNotFound: 'PRODUCT_NOT_FOUND',
  ProductImageNotFound: 'PRODUCT_IMAGE_NOT_FOUND',
  FeaturedProductNotFound: 'FEATURED_PRODUCT_NOT_FOUND',
  FeaturedProductConflict: 'FEATURED_PRODUCT_CONFLICT',
  ShareNotFound: 'SHARE_NOT_FOUND',
  ShareSignatureInvalid: 'SHARE_SIGNATURE_INVALID',
  ShareSignatureExpired: 'SHARE_SIGNATURE_EXPIRED',
  AiFeatureDisabled: 'AI_FEATURE_DISABLED',
  AiModelNotConfigured: 'AI_MODEL_NOT_CONFIGURED',
  AiRateLimited: 'AI_RATE_LIMITED',
  AiQuotaExceeded: 'AI_QUOTA_EXCEEDED',
  AiProviderError: 'AI_PROVIDER_ERROR'
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
