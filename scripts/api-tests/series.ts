import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  asArray,
  asObject,
  assertErrorCode,
  defaultEmail,
  ensureTenantSession,
  readObject,
  readString,
  uniqueSuffix,
} from './lib';

export const seriesModule: TestModule = {
  name: 'series',
  description: 'Series read-only checks with pagination and tenant isolation assertions',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('series');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  let checks = 0;
  let validatedSeriesId: string | null = null;

  const listResponse = await ctx.request({
    method: 'GET',
    path: '/series',
    token: session.token,
    query: { page: 1, pageSize: 10 },
  });

  if (listResponse.status !== 200) {
    throw new ApiTestError(`list series expected 200, got ${listResponse.status}`);
  }

  const listBody = asObject(listResponse.body, 'series.list response');
  const items = asArray(listBody.items, 'series.list.items');
  assertPageEnvelope(listBody, 1, 10, 'series.list');
  checks += 1;

  const invalidListResponse = await ctx.request({
    method: 'GET',
    path: '/series',
    token: session.token,
    query: { page: 0, pageSize: 10 },
  });

  if (invalidListResponse.status !== 400) {
    throw new ApiTestError(`series invalid page expected 400, got ${invalidListResponse.status}`);
  }
  assertErrorCode(invalidListResponse, 'INVALID_REQUEST_PAYLOAD');
  checks += 1;

  const missingSeriesId = uniqueSuffix('missing-series');
  const missingSeriesResponse = await ctx.request({
    method: 'GET',
    path: `/series/${encodeURIComponent(missingSeriesId)}`,
    token: session.token,
  });

  if (missingSeriesResponse.status !== 404) {
    throw new ApiTestError(`series not-found expected 404, got ${missingSeriesResponse.status}`);
  }
  assertErrorCode(missingSeriesResponse, 'SERIES_NOT_FOUND');
  checks += 1;

  if (items.length > 0) {
    const firstSeries = asObject(items[0], 'series.list.item[0]');
    const seriesId = readString(firstSeries, 'id', 'series.list.item[0].id');

    const detailResponse = await ctx.request({
      method: 'GET',
      path: `/series/${encodeURIComponent(seriesId)}`,
      token: session.token,
    });

    if (detailResponse.status !== 200) {
      throw new ApiTestError(`series detail expected 200, got ${detailResponse.status}`);
    }

    const detailBody = asObject(detailResponse.body, 'series.detail response');
    const series = readObject(detailBody, 'series', 'series.detail.series');
    if (readString(series, 'id', 'series.detail.series.id') !== seriesId) {
      throw new ApiTestError(`series detail id mismatch: expected ${seriesId}`);
    }

    checks += 1;
    validatedSeriesId = seriesId;

    const crossTenantSession = await ensureTenantSession(ctx, {
      email: defaultEmail('api-series-cross-tenant'),
    });
    const crossTenantResponse = await ctx.request({
      method: 'GET',
      path: `/series/${encodeURIComponent(seriesId)}`,
      token: crossTenantSession.token,
    });

    if (crossTenantResponse.status !== 404) {
      throw new ApiTestError(
        `series cross-tenant read expected 404, got ${crossTenantResponse.status}`,
      );
    }
    assertErrorCode(crossTenantResponse, 'SERIES_NOT_FOUND');
    checks += 1;
  } else {
    ctx.log.warn('series.seed.warn', {
      tenantId: session.tenantId,
      message: 'No series rows found in tenant; detail and cross-tenant checks skipped.',
    });
  }

  ctx.log.ok('series.done', {
    checks,
    tenantId: session.tenantId,
    itemCount: items.length,
    validatedSeriesId: validatedSeriesId ?? 'none',
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      itemCount: items.length,
      validatedSeriesId,
    },
  };
}

function assertPageEnvelope(
  body: Record<string, unknown>,
  expectedPage: number,
  expectedPageSize: number,
  label: string,
): void {
  assertInteger(body.page, `${label}.page`);
  assertInteger(body.pageSize, `${label}.pageSize`);
  assertInteger(body.total, `${label}.total`);
  assertInteger(body.totalPages, `${label}.totalPages`);

  if (body.page !== expectedPage) {
    throw new ApiTestError(`Expected ${label}.page=${expectedPage}, got ${String(body.page)}`);
  }

  if (body.pageSize !== expectedPageSize) {
    throw new ApiTestError(
      `Expected ${label}.pageSize=${expectedPageSize}, got ${String(body.pageSize)}`,
    );
  }

  if ((body.total as number) < 0) {
    throw new ApiTestError(`Expected ${label}.total to be non-negative`);
  }

  if ((body.totalPages as number) < 1) {
    throw new ApiTestError(`Expected ${label}.totalPages to be >= 1`);
  }
}

function assertInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ApiTestError(`Expected ${label} integer, got ${String(value)}`);
  }
}
