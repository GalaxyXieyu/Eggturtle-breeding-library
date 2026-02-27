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
  uniqueSuffix,
} from './lib';

export const breedersModule: TestModule = {
  name: 'breeders',
  description: 'Breeders read-only checks with not-found/invalid guards and tenant isolation',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('breeders');

  const session = await ensureTenantSession(ctx, {
    email: ctx.options.email,
    tenantId: ctx.options.tenantId,
    tenantSlug: ctx.options.tenantSlug,
    tenantName: ctx.options.tenantName,
  });

  let checks = 0;
  let validatedBreederId: string | null = null;

  const listResponse = await ctx.request({
    method: 'GET',
    path: '/breeders',
    token: session.token,
    query: { page: 1, pageSize: 10 },
  });

  if (listResponse.status !== 200) {
    throw new ApiTestError(`list breeders expected 200, got ${listResponse.status}`);
  }

  const listBody = asObject(listResponse.body, 'breeders.list response');
  const listItems = asArray(listBody.items, 'breeders.list.items');
  assertPageEnvelope(listBody, 1, 10, 'breeders.list');
  checks += 1;

  const invalidListResponse = await ctx.request({
    method: 'GET',
    path: '/breeders',
    token: session.token,
    query: { page: 0, pageSize: 10 },
  });

  if (invalidListResponse.status !== 400) {
    throw new ApiTestError(
      `breeders invalid pagination expected 400, got ${invalidListResponse.status}`,
    );
  }
  assertErrorCode(invalidListResponse, 'INVALID_REQUEST_PAYLOAD');
  checks += 1;

  const invalidCodeResponse = await ctx.request({
    method: 'GET',
    path: '/breeders/by-code/%20%20',
    token: session.token,
  });

  if (invalidCodeResponse.status !== 400) {
    throw new ApiTestError(
      `breeders by-code invalid param expected 400, got ${invalidCodeResponse.status}`,
    );
  }
  assertErrorCode(invalidCodeResponse, 'INVALID_REQUEST_PAYLOAD');
  checks += 1;

  const missingBreederId = uniqueSuffix('missing-breeder');

  const missingDetailResponse = await ctx.request({
    method: 'GET',
    path: `/breeders/${encodeURIComponent(missingBreederId)}`,
    token: session.token,
  });
  if (missingDetailResponse.status !== 404) {
    throw new ApiTestError(`breeder detail not-found expected 404, got ${missingDetailResponse.status}`);
  }
  assertErrorCode(missingDetailResponse, 'BREEDER_NOT_FOUND');
  checks += 1;

  const missingEventsResponse = await ctx.request({
    method: 'GET',
    path: `/breeders/${encodeURIComponent(missingBreederId)}/events`,
    token: session.token,
  });
  if (missingEventsResponse.status !== 404) {
    throw new ApiTestError(`breeder events not-found expected 404, got ${missingEventsResponse.status}`);
  }
  assertErrorCode(missingEventsResponse, 'BREEDER_NOT_FOUND');
  checks += 1;

  const missingTreeResponse = await ctx.request({
    method: 'GET',
    path: `/breeders/${encodeURIComponent(missingBreederId)}/family-tree`,
    token: session.token,
  });
  if (missingTreeResponse.status !== 404) {
    throw new ApiTestError(`breeder family-tree not-found expected 404, got ${missingTreeResponse.status}`);
  }
  assertErrorCode(missingTreeResponse, 'BREEDER_NOT_FOUND');
  checks += 1;

  if (listItems.length > 0) {
    const breederItem = asObject(listItems[0], 'breeders.list.item[0]');
    const breederId = readString(breederItem, 'id', 'breeders.list.item[0].id');
    const breederCode = readString(breederItem, 'code', 'breeders.list.item[0].code');

    const detailResponse = await ctx.request({
      method: 'GET',
      path: `/breeders/${encodeURIComponent(breederId)}`,
      token: session.token,
    });

    if (detailResponse.status !== 200) {
      throw new ApiTestError(`breeder detail expected 200, got ${detailResponse.status}`);
    }

    const detailBody = asObject(detailResponse.body, 'breeders.detail response');
    const breeder = readObject(detailBody, 'breeder', 'breeders.detail.breeder');
    if (readString(breeder, 'id', 'breeders.detail.breeder.id') !== breederId) {
      throw new ApiTestError(`breeder detail id mismatch: expected ${breederId}`);
    }
    checks += 1;

    const byCodeResponse = await ctx.request({
      method: 'GET',
      path: `/breeders/by-code/${encodeURIComponent(breederCode)}`,
      token: session.token,
    });

    if (byCodeResponse.status !== 200) {
      throw new ApiTestError(`breeder by-code expected 200, got ${byCodeResponse.status}`);
    }

    const byCodeBody = asObject(byCodeResponse.body, 'breeders.by-code response');
    const breederByCode = readObject(byCodeBody, 'breeder', 'breeders.by-code.breeder');
    if (readString(breederByCode, 'id', 'breeders.by-code.breeder.id') !== breederId) {
      throw new ApiTestError(`breeder by-code mismatch: expected id ${breederId}`);
    }
    checks += 1;

    const eventsResponse = await ctx.request({
      method: 'GET',
      path: `/breeders/${encodeURIComponent(breederId)}/events`,
      token: session.token,
    });

    if (eventsResponse.status !== 200) {
      throw new ApiTestError(`breeder events expected 200, got ${eventsResponse.status}`);
    }

    const eventsBody = asObject(eventsResponse.body, 'breeders.events response');
    const events = asArray(eventsBody.events, 'breeders.events.events');
    assertEventsSortedDesc(events);
    checks += 1;

    const treeResponse = await ctx.request({
      method: 'GET',
      path: `/breeders/${encodeURIComponent(breederId)}/family-tree`,
      token: session.token,
    });

    if (treeResponse.status !== 200) {
      throw new ApiTestError(`breeder family-tree expected 200, got ${treeResponse.status}`);
    }

    const treeBody = asObject(treeResponse.body, 'breeders.family-tree response');
    const tree = readObject(treeBody, 'tree', 'breeders.family-tree.tree');
    assertFamilyTreeShape(tree);
    const treeSelf = readObject(tree, 'self', 'breeders.family-tree.tree.self');
    if (readString(treeSelf, 'id', 'breeders.family-tree.tree.self.id') !== breederId) {
      throw new ApiTestError(`breeder family-tree self mismatch: expected id ${breederId}`);
    }
    checks += 1;

    const crossTenantSession = await ensureTenantSession(ctx, {
      email: defaultEmail('api-breeders-cross-tenant'),
    });
    const crossTenantResponse = await ctx.request({
      method: 'GET',
      path: `/breeders/${encodeURIComponent(breederId)}`,
      token: crossTenantSession.token,
    });

    if (crossTenantResponse.status !== 404) {
      throw new ApiTestError(
        `breeder cross-tenant read expected 404, got ${crossTenantResponse.status}`,
      );
    }
    assertErrorCode(crossTenantResponse, 'BREEDER_NOT_FOUND');
    checks += 1;

    validatedBreederId = breederId;
  } else {
    ctx.log.warn('breeders.seed.warn', {
      tenantId: session.tenantId,
      message: 'No breeder rows found in tenant; positive detail/events/family-tree checks skipped.',
    });
  }

  ctx.log.ok('breeders.done', {
    checks,
    tenantId: session.tenantId,
    itemCount: listItems.length,
    validatedBreederId: validatedBreederId ?? 'none',
  });

  return {
    checks,
    details: {
      tenantId: session.tenantId,
      itemCount: listItems.length,
      validatedBreederId,
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

function assertEventsSortedDesc(events: unknown[]): void {
  let previousTs = Number.POSITIVE_INFINITY;

  for (let i = 0; i < events.length; i += 1) {
    const event = asObject(events[i], `breeders.events.events[${i}]`);
    ensureKeys(
      event,
      ['id', 'tenantId', 'breederId', 'eventType', 'eventDate', 'note', 'createdAt', 'updatedAt'],
      `breeders.events.events[${i}]`,
    );

    const eventDate = readString(event, 'eventDate', `breeders.events.events[${i}].eventDate`);
    const parsed = Date.parse(eventDate);
    if (Number.isNaN(parsed)) {
      throw new ApiTestError(`Invalid eventDate at index ${i}: ${eventDate}`);
    }

    if (parsed > previousTs) {
      throw new ApiTestError('breeders.events.events is not sorted by eventDate desc');
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
  nodeLabel: string,
): void {
  if (linkValue === null) {
    return;
  }

  const link = asObject(linkValue, linkLabel);
  readString(link, 'code', `${linkLabel}.code`);

  const linkBreeder = link.breeder;
  if (linkBreeder !== null) {
    const breeder = asObject(linkBreeder, `${linkLabel}.breeder`);
    ensureKeys(breeder, ['id', 'code', 'name', 'sex'], `${linkLabel}.breeder`);

    if (nodeValue !== null) {
      const node = asObject(nodeValue, nodeLabel);
      const nodeId = readString(node, 'id', `${nodeLabel}.id`);
      const breederId = readString(breeder, 'id', `${linkLabel}.breeder.id`);
      if (nodeId !== breederId) {
        throw new ApiTestError(`${linkLabel}.breeder.id does not match ${nodeLabel}.id`);
      }
    }
  }
}

function assertInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ApiTestError(`Expected ${label} integer, got ${String(value)}`);
  }
}
