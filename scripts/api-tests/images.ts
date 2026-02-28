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
  readBoolean,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const imagesModule: TestModule = {
  name: 'images',
  description: 'Product image upload/set-main/reorder/delete checks with tenant scoping',
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

  const firstUpload = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile('file', 'image-a.png'),
  });
  if (firstUpload.status !== 201) {
    throw new ApiTestError(`upload first image expected 201, got ${firstUpload.status}`);
  }

  const firstImageBody = asObject(firstUpload.body, 'products.images.upload.first response');
  const firstImage = readObject(firstImageBody, 'image', 'products.images.upload.first.image');
  const firstImageId = readString(firstImage, 'id', 'products.images.upload.first.image.id');
  if (!readBoolean(firstImage, 'isMain', 'products.images.upload.first.image.isMain')) {
    throw new ApiTestError('first uploaded image should be main image');
  }
  checks += 1;

  const secondUpload = await ctx.request({
    method: 'POST',
    path: `/products/${productId}/images`,
    token: session.token,
    formData: createTinyPngFile('file', 'image-b.png'),
  });
  if (secondUpload.status !== 201) {
    throw new ApiTestError(`upload second image expected 201, got ${secondUpload.status}`);
  }

  const secondImageBody = asObject(secondUpload.body, 'products.images.upload.second response');
  const secondImage = readObject(secondImageBody, 'image', 'products.images.upload.second.image');
  const secondImageId = readString(secondImage, 'id', 'products.images.upload.second.image.id');
  if (readBoolean(secondImage, 'isMain', 'products.images.upload.second.image.isMain')) {
    throw new ApiTestError('second uploaded image should not be main image');
  }
  checks += 1;

  const setMainResponse = await ctx.request({
    method: 'PUT',
    path: `/products/${productId}/images/${secondImageId}/main`,
    token: session.token,
  });
  if (setMainResponse.status !== 200) {
    throw new ApiTestError(`set main image expected 200, got ${setMainResponse.status}`);
  }

  const setMainBody = asObject(setMainResponse.body, 'products.images.main response');
  const setMainImage = readObject(setMainBody, 'image', 'products.images.main.image');
  if (readString(setMainImage, 'id', 'products.images.main.image.id') !== secondImageId) {
    throw new ApiTestError('set main response returned unexpected image id');
  }
  if (!readBoolean(setMainImage, 'isMain', 'products.images.main.image.isMain')) {
    throw new ApiTestError('set main response should mark target image as main');
  }
  checks += 1;

  const reorderResponse = await ctx.request({
    method: 'PUT',
    path: `/products/${productId}/images/reorder`,
    token: session.token,
    json: {
      imageIds: [secondImageId, firstImageId],
    },
  });
  if (reorderResponse.status !== 200) {
    throw new ApiTestError(`reorder images expected 200, got ${reorderResponse.status}`);
  }

  const reorderBody = asObject(reorderResponse.body, 'products.images.reorder response');
  const reordered = asArray(reorderBody.images, 'products.images.reorder.images')
    .map((entry) => asObject(entry, 'products.images.reorder.item'));

  if (reordered.length !== 2) {
    throw new ApiTestError(`reorder images expected 2 images, got ${reordered.length}`);
  }

  if (readString(reordered[0], 'id', 'products.images.reorder[0].id') !== secondImageId) {
    throw new ApiTestError('reorder images unexpected first image id');
  }
  if (readString(reordered[1], 'id', 'products.images.reorder[1].id') !== firstImageId) {
    throw new ApiTestError('reorder images unexpected second image id');
  }
  checks += 1;

  const listImagesResponse = await ctx.request({
    method: 'GET',
    path: `/products/${productId}/images`,
    token: session.token,
  });
  if (listImagesResponse.status !== 200) {
    throw new ApiTestError(`list images expected 200, got ${listImagesResponse.status}`);
  }

  const listImagesBody = asObject(listImagesResponse.body, 'products.images.list response');
  const listedImages = asArray(listImagesBody.images, 'products.images.list.images').map((entry) =>
    asObject(entry, 'products.images.list.item'),
  );

  if (listedImages.length !== 2) {
    throw new ApiTestError(`list images expected 2 images, got ${listedImages.length}`);
  }
  if (readString(listedImages[0], 'id', 'products.images.list[0].id') !== secondImageId) {
    throw new ApiTestError('list images unexpected first image id');
  }
  if (!readBoolean(listedImages[0], 'isMain', 'products.images.list[0].isMain')) {
    throw new ApiTestError('list images expected first item to be main after set-main');
  }
  checks += 1;

  const contentResponse = await ctx.request({
    method: 'GET',
    path: `/products/${productId}/images/${secondImageId}/content`,
    token: session.token,
    redirect: 'manual',
  });
  if (![200, 302].includes(contentResponse.status)) {
    throw new ApiTestError(
      `image content expected 200 or 302, got ${contentResponse.status} (imageId=${secondImageId})`,
    );
  }
  checks += 1;

  const foreignSession = await ensureTenantSession(ctx, {
    email: defaultEmail('images-foreign-tenant'),
  });

  const foreignRead = await ctx.request({
    method: 'GET',
    path: `/products/${productId}/images/${secondImageId}/content`,
    token: foreignSession.token,
    redirect: 'manual',
  });
  if (foreignRead.status !== 404) {
    throw new ApiTestError(`cross-tenant image read expected 404, got ${foreignRead.status}`);
  }
  assertErrorCode(foreignRead, 'PRODUCT_NOT_FOUND');
  checks += 1;

  const foreignDelete = await ctx.request({
    method: 'DELETE',
    path: `/products/${productId}/images/${secondImageId}`,
    token: foreignSession.token,
  });
  if (foreignDelete.status !== 404) {
    throw new ApiTestError(`cross-tenant image delete expected 404, got ${foreignDelete.status}`);
  }
  assertErrorCode(foreignDelete, 'PRODUCT_NOT_FOUND');
  checks += 1;

  const deleteMainResponse = await ctx.request({
    method: 'DELETE',
    path: `/products/${productId}/images/${secondImageId}`,
    token: session.token,
  });
  if (deleteMainResponse.status !== 200) {
    throw new ApiTestError(`delete main image expected 200, got ${deleteMainResponse.status}`);
  }
  checks += 1;

  const deleteRemainingResponse = await ctx.request({
    method: 'DELETE',
    path: `/products/${productId}/images/${firstImageId}`,
    token: session.token,
  });
  if (deleteRemainingResponse.status !== 200) {
    throw new ApiTestError(`delete remaining image expected 200, got ${deleteRemainingResponse.status}`);
  }
  checks += 1;

  const deletedContentResponse = await ctx.request({
    method: 'GET',
    path: `/products/${productId}/images/${firstImageId}/content`,
    token: session.token,
    redirect: 'manual',
  });
  if (deletedContentResponse.status !== 404) {
    throw new ApiTestError(`deleted image content expected 404, got ${deletedContentResponse.status}`);
  }
  assertErrorCode(deletedContentResponse, 'PRODUCT_IMAGE_NOT_FOUND');
  checks += 1;

  ctx.log.ok('images.done', {
    checks,
    tenantId: session.tenantId,
    productId,
    firstImageId,
    secondImageId,
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      productId,
      firstImageId,
      secondImageId,
    },
  };
}
