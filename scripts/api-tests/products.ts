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
  description: 'Products create/list checks including legacy fields and filter/sort/pagination behavior',
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
  const marker = uniqueSuffix('api-product-marker').toUpperCase().slice(0, 64);
  const codePrefix = uniqueSuffix('api-product').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
  const codeA = `${codePrefix}-A`;
  const codeB = `${codePrefix}-B`;
  const codeC = `${codePrefix}-C`;

  const seriesListResponse = await ctx.request({
    method: 'GET',
    path: '/series',
    token: session.token,
    query: { page: 1, pageSize: 1 },
  });

  let selectedSeriesId: string | null = null;
  if (seriesListResponse.status === 200) {
    const seriesListBody = asObject(seriesListResponse.body, 'products.series-list response');
    const items = asArray(seriesListBody.items, 'products.series-list.items');
    if (items.length > 0) {
      const firstSeries = asObject(items[0], 'products.series-list.items[0]');
      selectedSeriesId = readString(firstSeries, 'id', 'products.series-list.items[0].id');
    }
  }

  const createAResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: codeA,
      description: marker,
      seriesId: selectedSeriesId ?? undefined,
      sex: 'male',
      offspringUnitPrice: 128.5,
      sireCode: 'SIRE-A',
      damCode: 'DAM-A',
      mateCode: 'MATE-A',
      excludeFromBreeding: true,
      hasSample: true,
      inStock: false,
      popularityScore: 33,
      isFeatured: true,
    },
  });

  if (createAResponse.status !== 201) {
    throw new ApiTestError(`create product A expected 201, got ${createAResponse.status}`);
  }

  const createABody = asObject(createAResponse.body, 'products.createA response');
  const productA = readObject(createABody, 'product', 'products.createA.product');
  const productAId = readString(productA, 'id', 'products.createA.product.id');
  if (readString(productA, 'code', 'products.createA.product.code') !== codeA) {
    throw new ApiTestError(`create product A code mismatch: expected ${codeA}`);
  }
  if (readString(productA, 'name', 'products.createA.product.name') !== codeA) {
    throw new ApiTestError('create product A should default name to code when name is omitted');
  }
  assertNullableStringField(productA, 'seriesId', 'products.createA.product.seriesId');
  assertNullableStringField(productA, 'sex', 'products.createA.product.sex', 'male');
  assertNullableNumberField(productA, 'offspringUnitPrice', 'products.createA.product.offspringUnitPrice', 128.5);
  assertNullableStringField(productA, 'sireCode', 'products.createA.product.sireCode', 'SIRE-A');
  assertNullableStringField(productA, 'damCode', 'products.createA.product.damCode', 'DAM-A');
  assertNullableStringField(productA, 'mateCode', 'products.createA.product.mateCode', 'MATE-A');
  assertBooleanField(productA, 'excludeFromBreeding', 'products.createA.product.excludeFromBreeding', true);
  assertBooleanField(productA, 'hasSample', 'products.createA.product.hasSample', true);
  assertBooleanField(productA, 'inStock', 'products.createA.product.inStock', false);
  assertNumberField(productA, 'popularityScore', 'products.createA.product.popularityScore', 33);
  assertBooleanField(productA, 'isFeatured', 'products.createA.product.isFeatured', true);
  if (selectedSeriesId && productA.seriesId !== selectedSeriesId) {
    throw new ApiTestError(
      `create product A seriesId mismatch: expected ${selectedSeriesId}, got ${String(productA.seriesId)}`,
    );
  }
  checks += 1;

  const createBResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: codeB,
      name: 'Product B',
      description: marker,
      sex: 'female',
      offspringUnitPrice: 256,
      sireCode: 'SIRE-B',
      damCode: 'DAM-B',
      mateCode: 'MATE-B',
      excludeFromBreeding: false,
      hasSample: false,
      inStock: true,
      popularityScore: 12,
      isFeatured: false,
    },
  });

  if (createBResponse.status !== 201) {
    throw new ApiTestError(`create product B expected 201, got ${createBResponse.status}`);
  }

  const createBBody = asObject(createBResponse.body, 'products.createB response');
  const productB = readObject(createBBody, 'product', 'products.createB.product');
  if (readString(productB, 'name', 'products.createB.product.name') !== 'Product B') {
    throw new ApiTestError('create product B should keep explicit name');
  }
  assertNullableStringField(productB, 'sex', 'products.createB.product.sex', 'female');
  checks += 1;

  const createCResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: session.token,
    json: {
      code: codeC,
      name: 'Product C',
      description: marker,
      sex: 'female',
      popularityScore: 77,
    },
  });

  if (createCResponse.status !== 201) {
    throw new ApiTestError(`create product C expected 201, got ${createCResponse.status}`);
  }
  checks += 1;

  const listPage1Response = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: {
      page: 1,
      pageSize: 2,
      search: marker,
      sortBy: 'code',
      sortDir: 'asc',
    },
  });

  if (listPage1Response.status !== 200) {
    throw new ApiTestError(`list products page1 expected 200, got ${listPage1Response.status}`);
  }

  const page1Body = asObject(listPage1Response.body, 'products.list.page1 response');
  const page1Products = asArray(page1Body.products, 'products.list.page1.products').map((entry) =>
    asObject(entry, 'products.list.page1.item'),
  );

  assertNumberField(page1Body, 'total', 'products.list.page1.total', 3);
  assertNumberField(page1Body, 'page', 'products.list.page1.page', 1);
  assertNumberField(page1Body, 'pageSize', 'products.list.page1.pageSize', 2);
  assertNumberField(page1Body, 'totalPages', 'products.list.page1.totalPages', 2);

  const page1Codes = page1Products.map((entry) => readString(entry, 'code', 'products.list.page1.item.code'));
  if (page1Codes.length !== 2 || page1Codes[0] !== codeA || page1Codes[1] !== codeB) {
    throw new ApiTestError(
      `list products page1 sort/pagination mismatch: expected [${codeA}, ${codeB}], got ${JSON.stringify(page1Codes)}`,
    );
  }

  const matchedA = page1Products.find((entry) => entry.id === productAId);
  if (!matchedA) {
    throw new ApiTestError(`list products page1 should include product A id=${productAId}`);
  }
  assertNullableStringField(matchedA, 'sex', 'products.list.page1.productA.sex', 'male');
  checks += 1;

  const listPage2Response = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: {
      page: 2,
      pageSize: 2,
      search: marker,
      sortBy: 'code',
      sortDir: 'asc',
    },
  });

  if (listPage2Response.status !== 200) {
    throw new ApiTestError(`list products page2 expected 200, got ${listPage2Response.status}`);
  }

  const page2Body = asObject(listPage2Response.body, 'products.list.page2 response');
  const page2Products = asArray(page2Body.products, 'products.list.page2.products').map((entry) =>
    asObject(entry, 'products.list.page2.item'),
  );
  const page2Codes = page2Products.map((entry) => readString(entry, 'code', 'products.list.page2.item.code'));
  if (page2Codes.length !== 1 || page2Codes[0] !== codeC) {
    throw new ApiTestError(
      `list products page2 sort/pagination mismatch: expected [${codeC}], got ${JSON.stringify(page2Codes)}`,
    );
  }
  checks += 1;

  const femaleFilterResponse = await ctx.request({
    method: 'GET',
    path: '/products',
    token: session.token,
    query: {
      page: 1,
      pageSize: 20,
      search: marker,
      sex: 'female',
      sortBy: 'code',
      sortDir: 'asc',
    },
  });

  if (femaleFilterResponse.status !== 200) {
    throw new ApiTestError(`list products female filter expected 200, got ${femaleFilterResponse.status}`);
  }

  const femaleFilterBody = asObject(femaleFilterResponse.body, 'products.list.female response');
  const femaleProducts = asArray(femaleFilterBody.products, 'products.list.female.products').map((entry) =>
    asObject(entry, 'products.list.female.item'),
  );
  const femaleCodes = femaleProducts.map((entry) => readString(entry, 'code', 'products.list.female.item.code'));

  if (femaleCodes.length !== 2 || femaleCodes[0] !== codeB || femaleCodes[1] !== codeC) {
    throw new ApiTestError(
      `list products female filter mismatch: expected [${codeB}, ${codeC}], got ${JSON.stringify(femaleCodes)}`,
    );
  }

  for (const product of femaleProducts) {
    assertNullableStringField(product, 'sex', 'products.list.female.item.sex', 'female');
  }
  checks += 1;

  if (selectedSeriesId) {
    const seriesFilterResponse = await ctx.request({
      method: 'GET',
      path: '/products',
      token: session.token,
      query: {
        page: 1,
        pageSize: 20,
        search: marker,
        seriesId: selectedSeriesId,
      },
    });

    if (seriesFilterResponse.status !== 200) {
      throw new ApiTestError(
        `list products seriesId filter expected 200, got ${seriesFilterResponse.status}`,
      );
    }

    const seriesFilterBody = asObject(seriesFilterResponse.body, 'products.list.series response');
    const seriesProducts = asArray(seriesFilterBody.products, 'products.list.series.products').map((entry) =>
      asObject(entry, 'products.list.series.item'),
    );

    const seriesCodes = seriesProducts.map((entry) => readString(entry, 'code', 'products.list.series.item.code'));
    if (seriesCodes.length !== 1 || seriesCodes[0] !== codeA) {
      throw new ApiTestError(
        `list products seriesId filter mismatch: expected [${codeA}], got ${JSON.stringify(seriesCodes)}`,
      );
    }

    checks += 1;
  } else {
    ctx.log.warn('products.series-filter.skip', {
      tenantId: session.tenantId,
      reason: 'No series found in tenant; seriesId filter assertion skipped.',
    });
  }

  ctx.log.ok('products.done', {
    checks,
    tenantId: session.tenantId,
    marker,
    createdCodes: [codeA, codeB, codeC],
    selectedSeriesId: selectedSeriesId ?? 'none',
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      marker,
      createdCodes: [codeA, codeB, codeC],
      selectedSeriesId,
    },
  };
}

function assertBooleanField(
  objectValue: Record<string, unknown>,
  key: string,
  label: string,
  expected: boolean,
): void {
  const value = objectValue[key];
  if (typeof value !== 'boolean') {
    throw new ApiTestError(`Expected ${label} boolean, got ${String(value)}`);
  }

  if (value !== expected) {
    throw new ApiTestError(`Expected ${label}=${String(expected)}, got ${String(value)}`);
  }
}

function assertNumberField(
  objectValue: Record<string, unknown>,
  key: string,
  label: string,
  expected: number,
): void {
  const value = objectValue[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ApiTestError(`Expected ${label} number, got ${String(value)}`);
  }

  if (value !== expected) {
    throw new ApiTestError(`Expected ${label}=${String(expected)}, got ${String(value)}`);
  }
}

function assertNullableStringField(
  objectValue: Record<string, unknown>,
  key: string,
  label: string,
  expected?: string,
): void {
  const value = objectValue[key];
  if (value !== null && typeof value !== 'string') {
    throw new ApiTestError(`Expected ${label} string|null, got ${String(value)}`);
  }

  if (expected !== undefined && value !== expected) {
    throw new ApiTestError(`Expected ${label}=${expected}, got ${String(value)}`);
  }
}

function assertNullableNumberField(
  objectValue: Record<string, unknown>,
  key: string,
  label: string,
  expected?: number,
): void {
  const value = objectValue[key];
  if (value !== null && (typeof value !== 'number' || Number.isNaN(value))) {
    throw new ApiTestError(`Expected ${label} number|null, got ${String(value)}`);
  }

  if (expected !== undefined && value !== expected) {
    throw new ApiTestError(`Expected ${label}=${String(expected)}, got ${String(value)}`);
  }
}
