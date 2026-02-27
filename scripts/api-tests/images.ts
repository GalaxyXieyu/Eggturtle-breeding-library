import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asObject,
  createTinyPngFile,
  ensureTenantSession,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const imagesModule: TestModule = {
  name: 'images',
  description: 'Product image upload/content/reorder/delete checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('images');

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
      code: uniqueSuffix('img-product').toUpperCase().slice(0, 64),
      name: `Image Product ${Date.now()}`,
      description: 'Image module fixture',
    },
  });
  if (createProductResponse.status !== 201) {
    throw new ApiTestError(`create product expected 201, got ${createProductResponse.status}`);
  }

  const createdProduct = readObject(asObject(createProductResponse.body), 'product');
  const productId = readString(createdProduct, 'id');
  checks += 1;

  const uploadResponse = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile(),
  });
  if (uploadResponse.status !== 201) {
    throw new ApiTestError(`upload image expected 201, got ${uploadResponse.status}`);
  }

  const uploadBody = asObject(uploadResponse.body, 'products.images.upload response');
  const image = readObject(uploadBody, 'image', 'products.images.upload.image');
  const imageId = readString(image, 'id', 'products.images.upload.image.id');
  checks += 1;

  const setMainResponse = await ctx.request({
    method: 'PUT',
    path: `/products/${productId}/images/${imageId}/main`,
    token: session.token,
  });
  if (setMainResponse.status !== 200) {
    throw new ApiTestError(`set main image expected 200, got ${setMainResponse.status}`);
  }
  checks += 1;

  const reorderResponse = await ctx.request({
    method: 'PUT',
    path: `/products/${productId}/images/reorder`,
    token: session.token,
    json: {
      imageIds: [imageId],
    },
  });
  if (reorderResponse.status !== 200) {
    throw new ApiTestError(`reorder images expected 200, got ${reorderResponse.status}`);
  }
  checks += 1;

  const contentResponse = await ctx.request({
    method: 'GET',
    path: `/products/${productId}/images/${imageId}/content`,
    token: session.token,
    redirect: 'manual',
  });
  if (![200, 302].includes(contentResponse.status)) {
    throw new ApiTestError(
      `image content expected 200 or 302, got ${contentResponse.status} (imageId=${imageId})`,
    );
  }
  checks += 1;

  const deleteResponse = await ctx.request({
    method: 'DELETE',
    path: `/products/${productId}/images/${imageId}`,
    token: session.token,
  });
  if (deleteResponse.status !== 200) {
    throw new ApiTestError(`delete image expected 200, got ${deleteResponse.status}`);
  }
  checks += 1;

  ctx.log.ok('images.done', {
    checks,
    tenantId: session.tenantId,
    productId,
    imageId,
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      productId,
      imageId,
    },
  };
}
