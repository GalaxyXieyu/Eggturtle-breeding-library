import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  assertErrorCode,
  asArray,
  asObject,
  createTinyPngFile,
  defaultEmail,
  ensureTenantSession,
  parseShareRedirect,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const sharesModule: TestModule = {
  name: 'shares',
  description: 'Share creation, redirect signature, public fetch, and tenant scoping checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('shares');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  let checks = 0;

  const createProductResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: uniqueSuffix('share-product').toUpperCase().slice(0, 64),
      name: `Share Product ${Date.now()}`,
      description: 'Share module fixture',
    },
  });
  if (createProductResponse.status !== 201) {
    throw new ApiTestError(`create product expected 201, got ${createProductResponse.status}`);
  }

  const product = readObject(asObject(createProductResponse.body), 'product');
  const productId = readString(product, 'id');
  checks += 1;

  const uploadImageResponse = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile(),
  });
  if (uploadImageResponse.status !== 201) {
    throw new ApiTestError(`upload image expected 201, got ${uploadImageResponse.status}`);
  }
  checks += 1;

  const createShareResponse = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: session.token,
    json: {
      resourceType: 'product',
      resourceId: productId,
    },
  });
  if (createShareResponse.status !== 201) {
    throw new ApiTestError(`create share expected 201, got ${createShareResponse.status}`);
  }

  const share = readObject(asObject(createShareResponse.body), 'share');
  const shareId = readString(share, 'id');
  const shareToken = readString(share, 'shareToken');
  checks += 1;

  const redirectResponse = await ctx.request({
    method: 'GET',
    path: `/s/${shareToken}`,
    redirect: 'manual',
  });
  if (redirectResponse.status !== 302) {
    throw new ApiTestError(`share redirect expected 302, got ${redirectResponse.status}`);
  }

  const location = redirectResponse.headers.get('location');
  if (!location) {
    throw new ApiTestError('share redirect missing location header');
  }

  if (!location.includes('/public/share')) {
    throw new ApiTestError(`share redirect target mismatch, expected /public/share, got: ${location}`);
  }

  const signed = parseShareRedirect(location);
  checks += 1;

  const publicResponse = await ctx.request({
    method: 'GET',
    path: `/shares/${signed.sid}/public`,
    query: {
      tenantId: signed.tenantId,
      resourceType: signed.resourceType,
      resourceId: signed.resourceId,
      exp: signed.exp,
      sig: signed.sig,
    },
  });
  if (publicResponse.status !== 200) {
    throw new ApiTestError(`public share expected 200, got ${publicResponse.status}`);
  }

  const publicBody = asObject(publicResponse.body, 'shares.public response');
  if (readString(publicBody, 'shareId', 'shares.public.shareId') !== shareId) {
    throw new ApiTestError('public share payload mismatch: shareId');
  }

  const publicProduct = readObject(publicBody, 'product', 'shares.public.product');
  if (readString(publicProduct, 'id', 'shares.public.product.id') !== productId) {
    throw new ApiTestError('public share payload mismatch: product.id');
  }

  const images = asArray(publicProduct.images, 'shares.public.product.images').map((entry) =>
    asObject(entry, 'shares.public.product.images.item'),
  );

  if (images.length < 1) {
    throw new ApiTestError('public share payload should contain uploaded images');
  }

  const firstImageUrl = readString(images[0], 'url', 'shares.public.product.images[0].url');
  if (firstImageUrl.startsWith('s3://')) {
    throw new ApiTestError('public share image URL should be browser-accessible, got s3:// URL');
  }
  checks += 1;

  const tamperedPublicResponse = await ctx.request({
    method: 'GET',
    path: `/shares/${signed.sid}/public`,
    query: {
      tenantId: signed.tenantId,
      resourceType: signed.resourceType,
      resourceId: signed.resourceId,
      exp: signed.exp,
      sig: `${signed.sig}x`,
    },
  });
  if (tamperedPublicResponse.status !== 401) {
    throw new ApiTestError(
      `tampered public share signature expected 401, got ${tamperedPublicResponse.status}`,
    );
  }
  assertErrorCode(tamperedPublicResponse, 'SHARE_SIGNATURE_INVALID');
  checks += 1;

  const foreignSession = await ensureTenantSession(ctx, {
    email: defaultEmail('shares-foreign-tenant'),
  });

  const foreignCreateShareResponse = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: foreignSession.token,
    json: {
      resourceType: 'product',
      resourceId: productId,
    },
  });
  if (foreignCreateShareResponse.status !== 404) {
    throw new ApiTestError(
      `cross-tenant create share expected 404, got ${foreignCreateShareResponse.status}`,
    );
  }
  assertErrorCode(foreignCreateShareResponse, 'PRODUCT_NOT_FOUND');
  checks += 1;

  ctx.log.ok('shares.done', {
    checks,
    tenantId: session.tenantId,
    shareId,
    productId,
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      shareId,
      productId,
    },
  };
}
