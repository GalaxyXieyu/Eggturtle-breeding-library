import {
  getAdminTenantSubscriptionResponseSchema,
  updateTenantSubscriptionResponseSchema,
} from '../../packages/shared/src/subscription';

import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asObject,
  assertErrorCode,
  assertStatus,
  createTinyPngFile,
  ensureTenantSession,
  loginWithDevCode,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const subscriptionModule: TestModule = {
  name: 'subscription',
  description: 'Admin subscription GET/PUT and tenant share/image quota enforcement checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('subscription');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  if (!ctx.options.superAdminEmail) {
    ctx.log.warn('subscription.skipped', {
      reason: 'missing --super-admin-email for admin GET/PUT subscription checks',
      tenantId: session.tenantId,
    });

    return {
      checks: 0,
      details: {
        skipped: true,
        reason: 'missing-super-admin-email',
        tenantId: session.tenantId,
      },
    };
  }

  let checks = 0;
  const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);

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
      hint: 'Enable SUPER_ADMIN_ENABLED and include email in SUPER_ADMIN_EMAILS for positive checks.',
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
      maxImages: 1,
      maxStorageBytes: '2048',
      maxShares: 1,
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

  const createShareDenied = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'product',
      resourceId: productId,
    },
  });
  assertStatus(createShareDenied, 403, 'subscription.share.denied-free-plan');
  assertErrorCode(createShareDenied, 'TENANT_SUBSCRIPTION_PLAN_INSUFFICIENT');
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

  const setProResponse = await ctx.request({
    method: 'PUT',
    path: `/admin/tenants/${session.tenantId}/subscription`,
    token: superAdminLogin.token,
    json: {
      plan: 'PRO',
      maxImages: null,
      maxStorageBytes: '1',
      maxShares: 3,
    },
  });
  assertStatus(setProResponse, 200, 'subscription.admin.set-pro');
  const setProPayload = updateTenantSubscriptionResponseSchema.parse(setProResponse.body);
  if (setProPayload.subscription.plan !== 'PRO') {
    throw new ApiTestError('subscription.admin.set-pro expected plan PRO');
  }
  checks += 1;

  const createShareAllowed = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'product',
      resourceId: productId,
    },
  });
  assertStatus(createShareAllowed, 201, 'subscription.share.allowed-pro-plan');
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
    },
  };
}
