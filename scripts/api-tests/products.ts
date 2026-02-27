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

export const productsModule: TestModule = {
  name: 'products',
  description: 'Products create/list checks inside one tenant',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('products');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  let checks = 0;
  const code = uniqueSuffix('api-product').toUpperCase().slice(0, 64);

  const createResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code,
      name: `API Product ${Date.now()}`,
      description: 'Created by scripts/api-tests/products.ts',
    },
  });

  if (createResponse.status !== 201) {
    throw new ApiTestError(`create product expected 201, got ${createResponse.status}`);
  }

  const createBody = asObject(createResponse.body, 'products.create response');
  const product = readObject(createBody, 'product', 'products.create.product');
  const productId = readString(product, 'id', 'products.create.product.id');
  readString(product, 'code', 'products.create.product.code');
  checks += 1;

  const listResponse = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: { page: 1, pageSize: 20 },
  });

  if (listResponse.status !== 200) {
    throw new ApiTestError(`list products expected 200, got ${listResponse.status}`);
  }

  const listBody = asObject(listResponse.body, 'products.list response');
  const products = asArray(listBody.products, 'products.list.products');

  const matchedProduct = products
    .map((entry) => asObject(entry, 'products.list.item'))
    .find((entry) => entry.id === productId);

  if (!matchedProduct) {
    throw new ApiTestError(`created product id not found in list: ${productId}`);
  }

  checks += 1;

  ctx.log.ok('products.done', {
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
