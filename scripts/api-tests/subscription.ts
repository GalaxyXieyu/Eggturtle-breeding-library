import { createWechatAuthorizeUrlResponseSchema } from '../../packages/shared/src/auth';
import { getAdminTenantUsageResponseSchema } from '../../packages/shared/src/admin';
import {
  createTenantSubscriptionActivationCodeResponseSchema,
  getAdminTenantSubscriptionResponseSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema,
  updateTenantSubscriptionResponseSchema,
} from '../../packages/shared/src/subscription';

import {
  ApiTestError,
  ModuleResult,
  TenantSession,
  TestContext,
  TestModule,
  asArray,
  asObject,
  assertErrorCode,
  assertStatus,
  createTinyPngFile,
  defaultEmail,
  ensureTenantSession,
  formatError,
  loginWithDevCode,
  readBoolean,
  readObject,
  readString,
  switchTenant,
  uniqueSuffix,
} from './lib';

export const subscriptionModule: TestModule = {
  name: 'subscription',
  description:
    'Admin subscription + activation-code generate/redeem and tenant image/storage quota enforcement checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('subscription');

  if (!ctx.options.superAdminEmail) {
    ctx.log.warn('subscription.skipped', {
      reason: 'missing --super-admin-email for admin GET/PUT subscription checks',
    });

    return {
      checks: 0,
      details: {
        skipped: true,
        reason: 'missing-super-admin-email',
        tenantId: null,
      },
    };
  }

  let checks = 0;
  const ownerEmail = ctx.options.email ?? defaultEmail('subscription-owner');
  const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);
  const session = await resolveSubscriptionSession(ctx, {
    ownerEmail,
    superAdminToken: superAdminLogin.token,
  });

  const usageBaseline = await readTenantUsageBaseline(ctx, superAdminLogin.token, session.tenantId);
  const freeProductLimit = Math.max(usageBaseline.productsUsed + 1, 1);
  const freeImageLimit = Math.max(usageBaseline.imagesUsed + 1, 1);
  const freeStorageLimit = (usageBaseline.storageUsedBytes + BigInt(1024)).toString();
  ctx.log.info('subscription.free-baseline', {
    tenantId: session.tenantId,
    existingProductCount: usageBaseline.productsUsed,
    existingImageCount: usageBaseline.imagesUsed,
    existingStorageBytes: usageBaseline.storageUsedBytes.toString(),
    freeProductLimit,
    freeImageLimit,
    freeStorageLimit,
  });

  const paymentsReadinessResponse = await ctx.request({
    method: 'GET',
    path: '/payments/readiness',
    token: superAdminLogin.token,
  });
  assertStatus(paymentsReadinessResponse, 200, 'subscription.payments.readiness');
  const readinessPayload = asObject(paymentsReadinessResponse.body, 'subscription.payments.readiness');
  const readinessProviders = readObject(readinessPayload, 'providers', 'subscription.payments.readiness.providers');
  const wechatProvider = readObject(readinessProviders, 'wechat', 'subscription.payments.readiness.providers.wechat');
  const wechatReady = readBoolean(wechatProvider, 'ready', 'subscription.payments.readiness.providers.wechat.ready');
  const requiredFields = asArray(
    (wechatProvider as Record<string, unknown>).requiredFields,
    'subscription.payments.readiness.providers.wechat.requiredFields',
  ).map((entry, index) =>
    readString(
      { value: entry },
      'value',
      `subscription.payments.readiness.providers.wechat.requiredFields[${index}]`,
    ),
  );
  for (const field of ['WECHAT_MP_APP_SECRET', 'PAYMENT_WECHAT_PRIVATE_KEY_PATH', 'PAYMENT_WECHAT_PLATFORM_CERT_PATH']) {
    if (!requiredFields.includes(field)) {
      throw new ApiTestError(`subscription.payments.readiness missing required field: ${field}`);
    }
  }
  checks += 1;

  if (wechatReady) {
    const authorizeUrlResponse = await ctx.request({
      method: 'POST',
      path: '/auth/wechat/authorize-url',
      token: session.token,
      json: {
        returnPath: `/app/${session.tenantSlug}/subscription`,
      },
    });
    assertStatus(authorizeUrlResponse, 201, 'subscription.wechat.authorize-url');
    const authorizePayload = createWechatAuthorizeUrlResponseSchema.parse(authorizeUrlResponse.body);
    if (!authorizePayload.authorizeUrl.includes('open.weixin.qq.com')) {
      throw new ApiTestError('subscription.wechat.authorize-url expected WeChat authorize domain');
    }
    checks += 1;

    const createOrderDeniedResponse = await ctx.request({
      method: 'POST',
      path: '/subscriptions/orders',
      token: session.token,
      json: {
        plan: 'BASIC',
        durationDays: 30,
        paymentChannel: 'JSAPI',
      },
    });
    assertStatus(createOrderDeniedResponse, 403, 'subscription.wechat.order-denied-without-binding');
    assertErrorCode(createOrderDeniedResponse, 'WECHAT_OAUTH_REQUIRED');
    checks += 1;
  } else {
    ctx.log.warn('subscription.wechat.skipped', {
      tenantId: session.tenantId,
      reason: 'wechat-provider-not-ready',
    });
  }

  const getBeforeResponse = await ctx.request({
    method: 'GET',
    path: `/admin/tenants/${session.tenantId}/subscription`,
    token: superAdminLogin.token,
  });
  checks += 1;

  if (getBeforeResponse.status !== 200) {
    if (ctx.options.requireSuperAdminPass) {
      throw new ApiTestError(
        `subscription.admin.get-before expected 200, got ${getBeforeResponse.status}`,
      );
    }

    ctx.log.warn('subscription.super-admin.warn', {
      status: getBeforeResponse.status,
      hint: 'Mark the target user as isSuperAdmin=true for positive checks.',
    });

    return {
      checks,
      details: {
        skipped: true,
        reason: 'super-admin-not-enabled-or-not-whitelisted',
        tenantId: session.tenantId,
        superAdminStatus: getBeforeResponse.status,
      },
    };
  }

  const beforePayload = getAdminTenantSubscriptionResponseSchema.parse(getBeforeResponse.body);
  if (beforePayload.subscription.tenantId !== session.tenantId) {
    throw new ApiTestError('subscription.admin.get-before tenantId mismatch');
  }

  const setFreeResponse = await ctx.request({
    method: 'PUT',
    path: `/admin/tenants/${session.tenantId}/subscription`,
    token: superAdminLogin.token,
    json: {
      plan: 'FREE',
      maxImages: freeImageLimit,
      maxStorageBytes: freeStorageLimit,
      maxShares: freeProductLimit,
    },
  });
  assertStatus(setFreeResponse, 200, 'subscription.admin.set-free');
  const setFreePayload = updateTenantSubscriptionResponseSchema.parse(setFreeResponse.body);
  if (setFreePayload.subscription.plan !== 'FREE') {
    throw new ApiTestError('subscription.admin.set-free expected plan FREE');
  }
  checks += 1;

  const createProductResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: uniqueSuffix('sub-product').toUpperCase().slice(0, 64),
      name: `Subscription Product ${Date.now()}`,
      description: 'Subscription module fixture',
    },
  });
  assertStatus(createProductResponse, 201, 'subscription.product.create');
  const product = readObject(asObject(createProductResponse.body), 'product');
  const productId = readString(product, 'id', 'subscription.product.id');
  checks += 1;

  const createProductDeniedResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: uniqueSuffix('sub-product-denied').toUpperCase().slice(0, 64),
      name: `Subscription Product Denied ${Date.now()}`,
      description: 'Subscription module quota denial fixture',
    },
  });
  assertStatus(createProductDeniedResponse, 403, 'subscription.product.create-denied-max-products');
  assertErrorCode(createProductDeniedResponse, 'TENANT_SUBSCRIPTION_QUOTA_EXCEEDED');
  checks += 1;

  const createShareOnFree = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'tenant_feed',
      resourceId: session.tenantId,
    },
  });
  assertStatus(createShareOnFree, 201, 'subscription.share.allowed-free-plan-1');
  checks += 1;

  const createShareOnFreeAgain = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'tenant_feed',
      resourceId: session.tenantId,
    },
  });
  assertStatus(createShareOnFreeAgain, 201, 'subscription.share.allowed-free-plan-2');
  checks += 1;

  const firstUpload = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile(),
  });
  assertStatus(firstUpload, 201, 'subscription.images.upload-1');
  checks += 1;

  const secondUploadDenied = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile(),
  });
  assertStatus(secondUploadDenied, 403, 'subscription.images.upload-2-denied-max-images');
  assertErrorCode(secondUploadDenied, 'TENANT_SUBSCRIPTION_QUOTA_EXCEEDED');
  checks += 1;

  const createActivationCodeResponse = await ctx.request({
    method: 'POST',
    path: '/admin/subscription-activation-codes',
    token: superAdminLogin.token,
    json: {
      targetTenantId: session.tenantId,
      plan: 'PRO',
      durationDays: 30,
      maxImages: null,
      maxStorageBytes: '1',
      maxShares: 3,
      redeemLimit: 1,
    },
  });
  assertStatus(createActivationCodeResponse, 201, 'subscription.activation-code.create');
  const createActivationCodePayload = createTenantSubscriptionActivationCodeResponseSchema.parse(
    createActivationCodeResponse.body,
  );
  if (createActivationCodePayload.activationCode.plan !== 'PRO') {
    throw new ApiTestError('subscription.activation-code.create expected plan PRO');
  }
  checks += 1;

  const redeemActivationCodeResponse = await ctx.request({
    method: 'POST',
    path: '/subscriptions/activation-codes/redeem',
    token: session.token,
    json: {
      code: createActivationCodePayload.activationCode.code,
    },
  });
  assertStatus(redeemActivationCodeResponse, 200, 'subscription.activation-code.redeem');
  const redeemActivationCodePayload = redeemTenantSubscriptionActivationCodeResponseSchema.parse(
    redeemActivationCodeResponse.body,
  );
  if (redeemActivationCodePayload.subscription.plan !== 'PRO') {
    throw new ApiTestError('subscription.activation-code.redeem expected plan PRO');
  }
  checks += 1;

  const redeemActivationCodeAgainResponse = await ctx.request({
    method: 'POST',
    path: '/subscriptions/activation-codes/redeem',
    token: session.token,
    json: {
      code: createActivationCodePayload.activationCode.code,
    },
  });
  assertStatus(
    redeemActivationCodeAgainResponse,
    403,
    'subscription.activation-code.redeem-denied-redeem-limit',
  );
  assertErrorCode(
    redeemActivationCodeAgainResponse,
    'SUBSCRIPTION_ACTIVATION_CODE_REDEEM_LIMIT_REACHED',
  );
  checks += 1;

  const createShareAllowed = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'tenant_feed',
      resourceId: session.tenantId,
    },
  });
  assertStatus(createShareAllowed, 201, 'subscription.share.allowed-after-upgrade');
  checks += 1;

  const storageDeniedUpload = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile(),
  });
  assertStatus(storageDeniedUpload, 403, 'subscription.images.denied-max-storage');
  assertErrorCode(storageDeniedUpload, 'TENANT_SUBSCRIPTION_QUOTA_EXCEEDED');
  checks += 1;

  const getAfterResponse = await ctx.request({
    method: 'GET',
    path: `/admin/tenants/${session.tenantId}/subscription`,
    token: superAdminLogin.token,
  });
  assertStatus(getAfterResponse, 200, 'subscription.admin.get-after');
  const afterPayload = getAdminTenantSubscriptionResponseSchema.parse(getAfterResponse.body);
  if (!afterPayload.subscription.isConfigured) {
    throw new ApiTestError('subscription.admin.get-after expected configured subscription');
  }
  if (afterPayload.subscription.plan !== 'PRO') {
    throw new ApiTestError('subscription.admin.get-after expected plan PRO');
  }
  checks += 1;

  ctx.log.ok('subscription.done', {
    checks,
    tenantId: session.tenantId,
    productId,
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      productId,
      freeProductLimit,
      freeImageLimit,
      freeStorageLimit,
    },
  };
}

async function resolveSubscriptionSession(
  ctx: TestContext,
  input: {
    ownerEmail: string;
    superAdminToken: string;
  },
): Promise<TenantSession> {
  if (ctx.options.provision) {
    return provisionSubscriptionSession(ctx, {
      ownerEmail: input.ownerEmail,
      superAdminToken: input.superAdminToken,
      tenantId: ctx.options.tenantId,
      tenantSlug: ctx.options.tenantSlug,
      tenantName: ctx.options.tenantName,
    });
  }

  try {
    return await ensureTenantSession(ctx, {
      email: input.ownerEmail,
      tenantId: ctx.options.tenantId,
      tenantSlug: ctx.options.tenantSlug,
      tenantName: ctx.options.tenantName,
    });
  } catch (error) {
    const message = formatError(error);

    if (message.includes('Email code login is only available for existing accounts.')) {
      ctx.log.warn('subscription.session.fallback-provision', {
        ownerEmail: input.ownerEmail,
        reason: 'owner-account-not-existing',
      });

      return provisionSubscriptionSession(ctx, {
        ownerEmail: input.ownerEmail,
        superAdminToken: input.superAdminToken,
        tenantId: ctx.options.tenantId,
        tenantSlug: ctx.options.tenantSlug,
        tenantName: ctx.options.tenantName,
      });
    }

    if (!ctx.options.tenantId && message.includes('User is already bound to tenant')) {
      ctx.log.warn('subscription.session.fallback-existing-tenant', {
        ownerEmail: input.ownerEmail,
      });
      return resolveBoundTenantSession(ctx, input.ownerEmail);
    }

    throw error;
  }
}

async function provisionSubscriptionSession(
  ctx: TestContext,
  input: {
    ownerEmail: string;
    superAdminToken: string;
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
  },
): Promise<TenantSession> {
  let tenantId = input.tenantId;
  let tenantSlug = input.tenantSlug ?? uniqueSuffix('subscription-tenant');
  let tenantName = input.tenantName ?? `Subscription Tenant ${Date.now()}`;

  if (!tenantId) {
    const createTenantResponse = await ctx.request({
      method: 'POST',
      path: '/admin/tenants',
      token: input.superAdminToken,
      json: {
        slug: tenantSlug,
        name: tenantName,
      },
    });
    assertStatus(createTenantResponse, 201, 'subscription.bootstrap.create-tenant');
    const tenant = readObject(asObject(createTenantResponse.body), 'tenant');
    tenantId = readString(tenant, 'id', 'subscription.bootstrap.tenant.id');
    tenantSlug = readString(tenant, 'slug', 'subscription.bootstrap.tenant.slug');
    tenantName = readString(tenant, 'name', 'subscription.bootstrap.tenant.name');
  }

  const upsertMemberResponse = await ctx.request({
    method: 'POST',
    path: `/admin/tenants/${tenantId}/members`,
    token: input.superAdminToken,
    json: {
      email: input.ownerEmail,
      role: 'OWNER',
    },
  });
  assertStatus(upsertMemberResponse, 201, 'subscription.bootstrap.upsert-owner');

  return ensureTenantSession(ctx, {
    email: input.ownerEmail,
    tenantId,
    tenantSlug,
    tenantName,
  });
}

async function resolveBoundTenantSession(ctx: TestContext, ownerEmail: string): Promise<TenantSession> {
  const ownerLogin = await loginWithDevCode(ctx, ownerEmail);
  const listTenantResponse = await ctx.request({
    method: 'GET',
    path: '/tenants/me',
    token: ownerLogin.token,
  });
  assertStatus(listTenantResponse, 200, 'subscription.tenants-me');
  const listTenantBody = asObject(listTenantResponse.body, 'subscription.tenants-me.body');
  const memberships = asArray(listTenantBody.tenants, 'subscription.tenants-me.tenants');
  if (memberships.length === 0) {
    throw new ApiTestError('subscription.tenants-me expected at least one tenant membership');
  }

  const firstMembership = asObject(memberships[0], 'subscription.tenants-me.tenants[0]');
  const tenant = readObject(firstMembership, 'tenant', 'subscription.tenants-me.tenants[0].tenant');
  const tenantId = readString(tenant, 'id', 'subscription.tenants-me.tenant.id');
  const tenantSlug = readString(tenant, 'slug', 'subscription.tenants-me.tenant.slug');
  const tenantName = readString(tenant, 'name', 'subscription.tenants-me.tenant.name');
  const switched = await switchTenant(ctx, ownerLogin.token, { tenantId });

  return {
    email: ownerEmail,
    baseToken: ownerLogin.token,
    token: switched.token,
    tenantId,
    tenantSlug,
    tenantName,
  };
}

async function readTenantUsageBaseline(
  ctx: TestContext,
  superAdminToken: string,
  tenantId: string,
): Promise<{ productsUsed: number; imagesUsed: number; storageUsedBytes: bigint }> {
  const usageResponse = await ctx.request({
    method: 'GET',
    path: `/admin/tenants/${tenantId}/usage`,
    token: superAdminToken,
  });
  assertStatus(usageResponse, 200, 'subscription.admin.tenant-usage');
  const usagePayload = getAdminTenantUsageResponseSchema.parse(usageResponse.body);
  const productsUsed = usagePayload.tenant.usage.products.used;
  const imagesUsed = usagePayload.tenant.usage.images.used;

  let storageUsedBytes: bigint;
  try {
    storageUsedBytes = BigInt(usagePayload.tenant.usage.storageBytes.usedBytes);
  } catch {
    throw new ApiTestError(
      `subscription.admin.tenant-usage invalid storage usedBytes: ${usagePayload.tenant.usage.storageBytes.usedBytes}`,
    );
  }

  return {
    productsUsed,
    imagesUsed,
    storageUsedBytes,
  };
}
