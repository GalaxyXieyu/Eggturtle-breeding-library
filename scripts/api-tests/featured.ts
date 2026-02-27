import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asArray,
  asObject,
  ensureTenantSession,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const featuredModule: TestModule = {
  name: 'featured',
  description: 'Featured products create/list/reorder/delete checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('featured');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  let checks = 0;

  const productA = await createProductFixture(ctx, session.token);
  const productB = await createProductFixture(ctx, session.token);
  checks += 2;

  const createFeaturedA = await ctx.request({
    method: 'POST',
    path: '/featured-products',
    token: session.token,
    json: { productId: productA.id, sortOrder: 0 },
  });
  if (createFeaturedA.status !== 201) {
    throw new ApiTestError(`create featured A expected 201, got ${createFeaturedA.status}`);
  }
  const featuredItemA = readObject(asObject(createFeaturedA.body), 'item');
  const featuredIdA = readString(featuredItemA, 'id');
  checks += 1;

  const createFeaturedB = await ctx.request({
    method: 'POST',
    path: '/featured-products',
    token: session.token,
    json: { productId: productB.id, sortOrder: 1 },
  });
  if (createFeaturedB.status !== 201) {
    throw new ApiTestError(`create featured B expected 201, got ${createFeaturedB.status}`);
  }
  const featuredItemB = readObject(asObject(createFeaturedB.body), 'item');
  const featuredIdB = readString(featuredItemB, 'id');
  checks += 1;

  const listResponse = await ctx.request({
    method: 'GET',
    path: '/featured-products',
    token: session.token,
  });
  if (listResponse.status !== 200) {
    throw new ApiTestError(`list featured expected 200, got ${listResponse.status}`);
  }
  const items = asArray(asObject(listResponse.body).items, 'featured.list.items');
  const ids = new Set(items.map((item) => readString(asObject(item), 'id')));
  if (!ids.has(featuredIdA) || !ids.has(featuredIdB)) {
    throw new ApiTestError(`featured list missing created items: ${featuredIdA}, ${featuredIdB}`);
  }
  checks += 1;

  const reorderResponse = await ctx.request({
    method: 'PUT',
    path: '/featured-products/reorder',
    token: session.token,
    json: {
      ids: [featuredIdB, featuredIdA],
    },
  });
  if (reorderResponse.status !== 200) {
    throw new ApiTestError(`reorder featured expected 200, got ${reorderResponse.status}`);
  }
  checks += 1;

  const deleteResponse = await ctx.request({
    method: 'DELETE',
    path: `/featured-products/${featuredIdA}`,
    token: session.token,
  });
  if (deleteResponse.status !== 200) {
    throw new ApiTestError(`delete featured expected 200, got ${deleteResponse.status}`);
  }
  checks += 1;

  ctx.log.ok('featured.done', {
    checks,
    tenantId: session.tenantId,
    featuredIdA,
    featuredIdB,
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      featuredIdA,
      featuredIdB,
    },
  };
}

async function createProductFixture(ctx: TestContext, token: string): Promise<{ id: string }> {
  const response = await ctx.request({
    method: 'POST',
    path: '/products',
    token,
    json: {
      code: uniqueSuffix('featured-product').toUpperCase().slice(0, 64),
      name: `Featured Product ${Date.now()}`,
    },
  });

  if (response.status !== 201) {
    throw new ApiTestError(`create product fixture expected 201, got ${response.status}`);
  }

  const body = asObject(response.body, 'products.create fixture response');
  const product = readObject(body, 'product', 'products.create fixture.product');
  return { id: readString(product, 'id', 'products.create fixture.product.id') };
}
