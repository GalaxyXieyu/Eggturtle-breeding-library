import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asArray,
  asObject,
  assertErrorCode,
  defaultEmail,
  ensureKeys,
  ensureTenantSession,
  readObject,
  readString,
  uniqueSuffix
} from './lib';

export const breedersModule: TestModule = {
  name: 'breeders',
  description: 'Product breeding-read checks (by-code/events/family-tree) with tenant isolation',
  requiresWrites: true,
  run
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('breeders');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName
  });

  let checks = 0;
  let validatedProductId: string | null = null;

  const listResponse = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: { page: 1, pageSize: 10 }
  });

  if (listResponse.status !== 200) {
    throw new ApiTestError(`list products expected 200, got ${listResponse.status}`);
  }

  const listBody = asObject(listResponse.body, 'products.list response');
  const listItems = asArray(listBody.products, 'products.list.products');
  assertPageEnvelope(listBody, 1, 10, 'products.list');
  checks += 1;

  const invalidListResponse = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: { page: 0, pageSize: 10 }
  });

  if (invalidListResponse.status !== 400) {
    throw new ApiTestError(`products invalid pagination expected 400, got ${invalidListResponse.status}`);
  }
  assertErrorCode(invalidListResponse, 'INVALID_REQUEST_PAYLOAD');
  checks += 1;

  const invalidCodeResponse = await ctx.request({
    method: 'GET',
    path: '/products/by-code/%20%20',
    token: session.token
  });

  if (invalidCodeResponse.status !== 400) {
    throw new ApiTestError(`products by-code invalid param expected 400, got ${invalidCodeResponse.status}`);
  }
  assertErrorCode(invalidCodeResponse, 'INVALID_REQUEST_PAYLOAD');
  checks += 1;

  const missingProductId = uniqueSuffix('missing-product');

  const missingDetailResponse = await ctx.request({
    method: 'GET',
    path: `/products/${encodeURIComponent(missingProductId)}`,
    token: session.token
  });
  if (missingDetailResponse.status !== 404) {
    throw new ApiTestError(`product detail not-found expected 404, got ${missingDetailResponse.status}`);
  }
  assertErrorCode(missingDetailResponse, 'PRODUCT_NOT_FOUND');
  checks += 1;

  const missingEventsResponse = await ctx.request({
    method: 'GET',
    path: `/products/${encodeURIComponent(missingProductId)}/events`,
    token: session.token
  });
  if (missingEventsResponse.status !== 404) {
    throw new ApiTestError(`product events not-found expected 404, got ${missingEventsResponse.status}`);
  }
  assertErrorCode(missingEventsResponse, 'PRODUCT_NOT_FOUND');
  checks += 1;

  const missingTreeResponse = await ctx.request({
    method: 'GET',
    path: `/products/${encodeURIComponent(missingProductId)}/family-tree`,
    token: session.token
  });
  if (missingTreeResponse.status !== 404) {
    throw new ApiTestError(`product family-tree not-found expected 404, got ${missingTreeResponse.status}`);
  }
  assertErrorCode(missingTreeResponse, 'PRODUCT_NOT_FOUND');
  checks += 1;

  if (listItems.length > 0) {
    const productItem = asObject(listItems[0], 'products.list.item[0]');
    const productId = readString(productItem, 'id', 'products.list.item[0].id');
    const productCode = readString(productItem, 'code', 'products.list.item[0].code');

    const detailResponse = await ctx.request({
      method: 'GET',
      path: `/products/${encodeURIComponent(productId)}`,
      token: session.token
    });

    if (detailResponse.status !== 200) {
      throw new ApiTestError(`product detail expected 200, got ${detailResponse.status}`);
    }

    const detailBody = asObject(detailResponse.body, 'products.detail response');
    const product = readObject(detailBody, 'product', 'products.detail.product');
    if (readString(product, 'id', 'products.detail.product.id') !== productId) {
      throw new ApiTestError(`product detail id mismatch: expected ${productId}`);
    }
    checks += 1;

    const byCodeResponse = await ctx.request({
      method: 'GET',
      path: `/products/by-code/${encodeURIComponent(productCode)}`,
      token: session.token
    });

    if (byCodeResponse.status !== 200) {
      throw new ApiTestError(`product by-code expected 200, got ${byCodeResponse.status}`);
    }

    const byCodeBody = asObject(byCodeResponse.body, 'products.by-code response');
    const productByCode = readObject(byCodeBody, 'product', 'products.by-code.product');
    if (readString(productByCode, 'id', 'products.by-code.product.id') !== productId) {
      throw new ApiTestError(`product by-code mismatch: expected id ${productId}`);
    }
    checks += 1;

    const eventsResponse = await ctx.request({
      method: 'GET',
      path: `/products/${encodeURIComponent(productId)}/events`,
      token: session.token
    });

    if (eventsResponse.status !== 200) {
      throw new ApiTestError(`product events expected 200, got ${eventsResponse.status}`);
    }

    const eventsBody = asObject(eventsResponse.body, 'products.events response');
    const events = asArray(eventsBody.events, 'products.events.events');
    assertEventsSortedDesc(events);
    checks += 1;

    const treeResponse = await ctx.request({
      method: 'GET',
      path: `/products/${encodeURIComponent(productId)}/family-tree`,
      token: session.token
    });

    if (treeResponse.status !== 200) {
      throw new ApiTestError(`product family-tree expected 200, got ${treeResponse.status}`);
    }

    const treeBody = asObject(treeResponse.body, 'products.family-tree response');
    const tree = readObject(treeBody, 'tree', 'products.family-tree.tree');
    assertFamilyTreeShape(tree);
    const treeSelf = readObject(tree, 'self', 'products.family-tree.tree.self');
    if (readString(treeSelf, 'id', 'products.family-tree.tree.self.id') !== productId) {
      throw new ApiTestError(`product family-tree self mismatch: expected id ${productId}`);
    }
    checks += 1;

    const crossTenantSession = await ensureTenantSession(ctx, {
      email: defaultEmail('api-products-cross-tenant')
    });
    const crossTenantResponse = await ctx.request({
      method: 'GET',
      path: `/products/${encodeURIComponent(productId)}`,
      token: crossTenantSession.token
    });

    if (crossTenantResponse.status !== 404) {
      throw new ApiTestError(`product cross-tenant read expected 404, got ${crossTenantResponse.status}`);
    }
    assertErrorCode(crossTenantResponse, 'PRODUCT_NOT_FOUND');
    checks += 1;

    validatedProductId = productId;
  } else {
    ctx.log.warn('products.seed.warn', {
      tenantId: session.tenantId,
      message: 'No product rows found; positive detail/events/family-tree checks skipped.'
    });
  }

  ctx.log.ok('breeders.done', {
    checks,
    tenantId: session.tenantId,
    itemCount: listItems.length,
    validatedProductId: validatedProductId ?? 'none'
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      itemCount: listItems.length,
      validatedProductId
    }
  };
}

function assertPageEnvelope(body: Record<string, unknown>, expectedPage: number, expectedPageSize: number, label: string): void {
  assertInteger(body.page, `${label}.page`);
  assertInteger(body.pageSize, `${label}.pageSize`);
  assertInteger(body.total, `${label}.total`);
  assertInteger(body.totalPages, `${label}.totalPages`);

  if (body.page !== expectedPage) {
    throw new ApiTestError(`Expected ${label}.page=${expectedPage}, got ${String(body.page)}`);
  }

  if (body.pageSize !== expectedPageSize) {
    throw new ApiTestError(`Expected ${label}.pageSize=${expectedPageSize}, got ${String(body.pageSize)}`);
  }

  if ((body.total as number) < 0) {
    throw new ApiTestError(`Expected ${label}.total to be non-negative`);
  }

  if ((body.totalPages as number) < 1) {
    throw new ApiTestError(`Expected ${label}.totalPages to be >= 1`);
  }
}

function assertEventsSortedDesc(events: unknown[]): void {
  let previousTs = Number.POSITIVE_INFINITY;

  for (let i = 0; i < events.length; i += 1) {
    const event = asObject(events[i], `products.events.events[${i}]`);
    ensureKeys(
      event,
      ['id', 'tenantId', 'productId', 'eventType', 'eventDate', 'note', 'createdAt', 'updatedAt'],
      `products.events.events[${i}]`
    );

    const eventDate = readString(event, 'eventDate', `products.events.events[${i}].eventDate`);
    const parsed = Date.parse(eventDate);
    if (Number.isNaN(parsed)) {
      throw new ApiTestError(`Invalid eventDate at index ${i}: ${eventDate}`);
    }

    if (parsed > previousTs) {
      throw new ApiTestError('products.events.events is not sorted by eventDate desc');
    }

    previousTs = parsed;
  }
}

function assertFamilyTreeShape(tree: Record<string, unknown>): void {
  ensureKeys(tree, ['self', 'sire', 'dam', 'mate', 'children', 'links', 'limitations'], 'tree');

  const children = asArray(tree.children, 'tree.children');
  for (let i = 0; i < children.length; i += 1) {
    const child = asObject(children[i], `tree.children[${i}]`);
    ensureKeys(child, ['id', 'code', 'name', 'sex'], `tree.children[${i}]`);
  }

  const links = readObject(tree, 'links', 'tree.links');
  ensureKeys(links, ['sire', 'dam', 'mate'], 'tree.links');

  validateFamilyTreeLink(links.sire, tree.sire, 'tree.links.sire', 'tree.sire');
  validateFamilyTreeLink(links.dam, tree.dam, 'tree.links.dam', 'tree.dam');
  validateFamilyTreeLink(links.mate, tree.mate, 'tree.links.mate', 'tree.mate');

  readString(tree, 'limitations', 'tree.limitations');
}

function validateFamilyTreeLink(
  linkValue: unknown,
  nodeValue: unknown,
  linkLabel: string,
  nodeLabel: string
): void {
  if (linkValue === null) {
    return;
  }

  const link = asObject(linkValue, linkLabel);
  readString(link, 'code', `${linkLabel}.code`);

  const linkProduct = link.product;
  if (linkProduct !== null) {
    const product = asObject(linkProduct, `${linkLabel}.product`);
    ensureKeys(product, ['id', 'code', 'name', 'sex'], `${linkLabel}.product`);

    if (nodeValue !== null) {
      const node = asObject(nodeValue, nodeLabel);
      const nodeId = readString(node, 'id', `${nodeLabel}.id`);
      const productId = readString(product, 'id', `${linkLabel}.product.id`);
      if (nodeId !== productId) {
        throw new ApiTestError(`${linkLabel}.product.id does not match ${nodeLabel}.id`);
      }
    }
  }
}

function assertInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ApiTestError(`Expected ${label} integer, got ${String(value)}`);
  }
}

