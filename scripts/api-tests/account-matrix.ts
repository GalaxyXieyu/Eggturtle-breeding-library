import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  assertErrorCode,
  assertStatus,
  asArray,
  asObject,
  createTinyPngFile,
  loginWithDevCode,
  parseShareRedirect,
  readObject,
  readString,
  switchTenant,
  uniqueSuffix,
} from './lib';

type RoleLabel = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

type RoleTokens = {
  OWNER: string;
  ADMIN: string;
  EDITOR: string;
  VIEWER: string;
};

export const accountMatrixModule: TestModule = {
  name: 'account-matrix',
  description: 'Role matrix verification for products/images/featured/shares/admin',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('account-matrix');

  const ownerEmail = requiredArg(ctx.options.ownerEmail, '--owner-email');
  const adminEmail = requiredArg(ctx.options.adminEmail, '--admin-email');
  const editorEmail = requiredArg(ctx.options.editorEmail, '--editor-email');
  const viewerEmail = requiredArg(ctx.options.viewerEmail, '--viewer-email');

  if (!ctx.options.provision && !ctx.options.tenantId) {
    throw new ApiTestError('account-matrix requires --tenant-id unless --provision is enabled');
  }

  if (ctx.options.provision && !ctx.options.superAdminEmail) {
    throw new ApiTestError(
      'account-matrix requires --super-admin-email when --provision is enabled',
    );
  }

  const health = await ctx.request({ method: 'GET', path: '/health' });
  assertStatus(health, 200, 'health');

  let checks = 1;
  ctx.log.info('account-matrix.start', {
    provision: ctx.options.provision,
    tenantId: ctx.options.tenantId ?? 'to-be-created',
    ownerEmail,
    adminEmail,
    editorEmail,
    viewerEmail,
  });

  const ownerBase = await loginWithDevCode(ctx, ownerEmail);
  const adminBase = await loginWithDevCode(ctx, adminEmail);
  const editorBase = await loginWithDevCode(ctx, editorEmail);
  const viewerBase = await loginWithDevCode(ctx, viewerEmail);
  checks += 4;

  let superAdminBaseToken: string | null = null;
  if (ctx.options.superAdminEmail) {
    superAdminBaseToken = (await loginWithDevCode(ctx, ctx.options.superAdminEmail)).token;
    checks += 1;
  }

  let tenantId = ctx.options.tenantId;
  let tenantSlug = ctx.options.tenantSlug ?? uniqueSuffix('matrix-tenant');
  let tenantName = ctx.options.tenantName ?? `Account Matrix ${Date.now()}`;

  if (ctx.options.provision) {
    if (!superAdminBaseToken) {
      throw new ApiTestError('super-admin token missing for provisioning');
    }

    const createTenant = await ctx.request({
      method: 'POST',
      path: '/admin/tenants',
      token: superAdminBaseToken,
      json: {
        slug: tenantSlug,
        name: tenantName,
      },
    });

    assertStatus(createTenant, 201, 'admin.create-tenant');
    const tenant = readObject(asObject(createTenant.body), 'tenant');
    tenantId = readString(tenant, 'id');
    tenantSlug = readString(tenant, 'slug');
    tenantName = readString(tenant, 'name');
    checks += 1;

    const roleAssignments: Array<{ role: RoleLabel; email: string }> = [
      { role: 'OWNER', email: ownerEmail },
      { role: 'ADMIN', email: adminEmail },
      { role: 'EDITOR', email: editorEmail },
      { role: 'VIEWER', email: viewerEmail },
    ];

    for (const assignment of roleAssignments) {
      const upsertMember = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminBaseToken,
        json: {
          email: assignment.email,
          role: assignment.role,
        },
      });
      assertStatus(upsertMember, 201, `admin.upsert-member.${assignment.role}`);
      checks += 1;
    }
  }

  if (!tenantId) {
    throw new ApiTestError('tenantId is required after provisioning stage');
  }

  const roleTokens: RoleTokens = {
    OWNER: (await switchTenant(ctx, ownerBase.token, { tenantId })).token,
    ADMIN: (await switchTenant(ctx, adminBase.token, { tenantId })).token,
    EDITOR: (await switchTenant(ctx, editorBase.token, { tenantId })).token,
    VIEWER: (await switchTenant(ctx, viewerBase.token, { tenantId })).token,
  };
  checks += 4;

  const ownerProductId = await createProductExpectAllowed(ctx, roleTokens.OWNER, 'OWNER');
  const adminProductId = await createProductExpectAllowed(ctx, roleTokens.ADMIN, 'ADMIN');
  const editorProductId = await createProductExpectAllowed(ctx, roleTokens.EDITOR, 'EDITOR');
  checks += 3;

  const viewerCreateProduct = await ctx.request({
    method: 'POST',
    path: '/products',
    token: roleTokens.VIEWER,
    json: {
      code: uniqueSuffix('viewer-product').toUpperCase().slice(0, 64),
      name: 'Viewer should fail',
    },
  });
  assertStatus(viewerCreateProduct, 403, 'viewer.products.create');
  assertErrorCode(viewerCreateProduct, 'FORBIDDEN');
  checks += 1;

  for (const [role, token] of Object.entries(roleTokens) as Array<[RoleLabel, string]>) {
    const listProducts = await ctx.request({ method: 'GET', path: '/products', token });
    assertStatus(listProducts, 200, `${role}.products.list`);
    checks += 1;
  }

  const ownerFeaturedId = await createFeaturedExpectAllowed(
    ctx,
    roleTokens.OWNER,
    ownerProductId,
    'OWNER',
  );
  const adminFeaturedId = await createFeaturedExpectAllowed(
    ctx,
    roleTokens.ADMIN,
    adminProductId,
    'ADMIN',
  );
  const editorFeaturedId = await createFeaturedExpectAllowed(
    ctx,
    roleTokens.EDITOR,
    editorProductId,
    'EDITOR',
  );
  checks += 3;

  const viewerCreateFeatured = await ctx.request({
    method: 'POST',
    path: '/featured-products',
    token: roleTokens.VIEWER,
    json: {
      productId: ownerProductId,
    },
  });
  assertStatus(viewerCreateFeatured, 403, 'viewer.featured.create');
  assertErrorCode(viewerCreateFeatured, 'FORBIDDEN');
  checks += 1;

  for (const [role, token] of Object.entries(roleTokens) as Array<[RoleLabel, string]>) {
    const listFeatured = await ctx.request({ method: 'GET', path: '/featured-products', token });
    assertStatus(listFeatured, 200, `${role}.featured.list`);
    const featuredBody = asObject(listFeatured.body);
    asArray(featuredBody.items, `${role}.featured.list.items`);
    checks += 1;
  }

  const ownerShare = await createShareExpectAllowed(ctx, roleTokens.OWNER, ownerProductId, 'OWNER');
  const adminShare = await createShareExpectAllowed(ctx, roleTokens.ADMIN, adminProductId, 'ADMIN');
  const editorShare = await createShareExpectAllowed(
    ctx,
    roleTokens.EDITOR,
    editorProductId,
    'EDITOR',
  );
  checks += 3;

  const viewerCreateShare = await ctx.request({
    method: 'POST',
    path: '/shares',
    token: roleTokens.VIEWER,
    json: {
      resourceType: 'product',
      resourceId: ownerProductId,
    },
  });
  assertStatus(viewerCreateShare, 403, 'viewer.shares.create');
  assertErrorCode(viewerCreateShare, 'FORBIDDEN');
  checks += 1;

  const shareRedirect = await ctx.request({
    method: 'GET',
    path: `/s/${ownerShare.shareToken}`,
    redirect: 'manual',
  });
  assertStatus(shareRedirect, 302, 'share.redirect');

  const redirectLocation = shareRedirect.headers.get('location');
  if (!redirectLocation) {
    throw new ApiTestError('share redirect is missing location header');
  }

  const signedParams = parseShareRedirect(redirectLocation);
  const publicShare = await ctx.request({
    method: 'GET',
    path: `/shares/${signedParams.sid}/public`,
    query: {
      tenantId: signedParams.tenantId,
      resourceType: signedParams.resourceType,
      resourceId: signedParams.resourceId,
      exp: signedParams.exp,
      sig: signedParams.sig,
    },
  });
  assertStatus(publicShare, 200, 'share.public');
  const publicShareBody = asObject(publicShare.body);
  const publicShareId = readString(publicShareBody, 'shareId', 'share.public.shareId');
  if (publicShareId !== ownerShare.shareId) {
    throw new ApiTestError(
      `public shareId mismatch: expected ${ownerShare.shareId}, got ${publicShareId}`,
    );
  }
  checks += 2;

  const uploadedImage = await ctx.request({
    method: 'POST',
    path: `/products/${ownerProductId}/images`,
    token: roleTokens.OWNER,
    formData: createTinyPngFile('file', 'matrix-a.png'),
  });
  assertStatus(uploadedImage, 201, 'owner.images.upload');
  const imageBody = asObject(uploadedImage.body);
  const image = readObject(imageBody, 'image', 'owner.images.upload.image');
  const firstImageId = readString(image, 'id', 'owner.images.upload.image.id');
  checks += 1;

  const secondUploadedImage = await ctx.request({
    method: 'POST',
    path: `/products/${ownerProductId}/images`,
    token: roleTokens.OWNER,
    formData: createTinyPngFile('file', 'matrix-b.png'),
  });
  assertStatus(secondUploadedImage, 201, 'owner.images.upload.second');
  const secondImageBody = asObject(secondUploadedImage.body);
  const secondImage = readObject(secondImageBody, 'image', 'owner.images.upload.second.image');
  const secondImageId = readString(secondImage, 'id', 'owner.images.upload.second.image.id');
  checks += 1;

  const viewerUploadImageDenied = await ctx.request({
    method: 'POST',
    path: `/products/${ownerProductId}/images`,
    token: roleTokens.VIEWER,
    formData: createTinyPngFile('file', 'matrix-viewer.png'),
  });
  assertStatus(viewerUploadImageDenied, 403, 'viewer.images.upload');
  assertErrorCode(viewerUploadImageDenied, 'FORBIDDEN');
  checks += 1;

  const adminSetMainImage = await ctx.request({
    method: 'PUT',
    path: `/products/${ownerProductId}/images/${secondImageId}/main`,
    token: roleTokens.ADMIN,
  });
  assertStatus(adminSetMainImage, 200, 'admin.images.set-main');
  checks += 1;

  const viewerSetMainDenied = await ctx.request({
    method: 'PUT',
    path: `/products/${ownerProductId}/images/${firstImageId}/main`,
    token: roleTokens.VIEWER,
  });
  assertStatus(viewerSetMainDenied, 403, 'viewer.images.set-main');
  assertErrorCode(viewerSetMainDenied, 'FORBIDDEN');
  checks += 1;

  const editorReorderImages = await ctx.request({
    method: 'PUT',
    path: `/products/${ownerProductId}/images/reorder`,
    token: roleTokens.EDITOR,
    json: {
      imageIds: [secondImageId, firstImageId],
    },
  });
  assertStatus(editorReorderImages, 200, 'editor.images.reorder');
  checks += 1;

  const viewerReorderDenied = await ctx.request({
    method: 'PUT',
    path: `/products/${ownerProductId}/images/reorder`,
    token: roleTokens.VIEWER,
    json: {
      imageIds: [firstImageId, secondImageId],
    },
  });
  assertStatus(viewerReorderDenied, 403, 'viewer.images.reorder');
  assertErrorCode(viewerReorderDenied, 'FORBIDDEN');
  checks += 1;

  const viewerDeleteImageDenied = await ctx.request({
    method: 'DELETE',
    path: `/products/${ownerProductId}/images/${firstImageId}`,
    token: roleTokens.VIEWER,
  });
  assertStatus(viewerDeleteImageDenied, 403, 'viewer.images.delete');
  assertErrorCode(viewerDeleteImageDenied, 'FORBIDDEN');
  checks += 1;

  const editorDeleteImage = await ctx.request({
    method: 'DELETE',
    path: `/products/${ownerProductId}/images/${secondImageId}`,
    token: roleTokens.EDITOR,
  });
  assertStatus(editorDeleteImage, 200, 'editor.images.delete');
  checks += 1;

  for (const [role, token] of Object.entries(roleTokens) as Array<[RoleLabel, string]>) {
    const imageContent = await ctx.request({
      method: 'GET',
      path: `/products/${ownerProductId}/images/${firstImageId}/content`,
      token,
      redirect: 'manual',
    });
    assertStatus(imageContent, [200, 302], `${role}.images.content`);
    checks += 1;
  }

  const imageId = firstImageId;

  for (const [role, token] of Object.entries(roleTokens) as Array<[RoleLabel, string]>) {
    const adminDenied = await ctx.request({ method: 'GET', path: '/admin/tenants', token });
    assertStatus(adminDenied, 403, `${role}.admin.tenants`);
    assertErrorCode(adminDenied, 'FORBIDDEN');
    checks += 1;
  }

  let superAdminStatus: number | null = null;
  if (superAdminBaseToken) {
    const superAdminCheck = await ctx.request({
      method: 'GET',
      path: '/admin/tenants',
      token: superAdminBaseToken,
    });
    superAdminStatus = superAdminCheck.status;

    if (ctx.options.requireSuperAdminPass) {
      assertStatus(superAdminCheck, 200, 'super-admin.admin.tenants');
      checks += 1;
    } else if (superAdminCheck.status !== 200) {
      ctx.log.warn('account-matrix.super-admin.warn', {
        status: superAdminCheck.status,
        hint: 'Enable SUPER_ADMIN_ENABLED and SUPER_ADMIN_EMAILS for positive assertions.',
      });
    } else {
      checks += 1;
    }
  }

  ctx.log.ok('account-matrix.done', {
    checks,
    tenantId,
    tenantSlug,
    tenantName,
    ownerProductId,
    imageId,
    ownerShareId: ownerShare.shareId,
    adminShareId: adminShare.shareId,
    editorShareId: editorShare.shareId,
    ownerFeaturedId,
    adminFeaturedId,
    editorFeaturedId,
    superAdminStatus: superAdminStatus ?? 'skipped',
  });

  return {
    checks,
    details: {
      tenantId,
      tenantSlug,
      tenantName,
      ownerProductId,
      imageId,
      ownerShareId: ownerShare.shareId,
      adminShareId: adminShare.shareId,
      editorShareId: editorShare.shareId,
      ownerFeaturedId,
      adminFeaturedId,
      editorFeaturedId,
      superAdminStatus,
    },
  };
}

async function createProductExpectAllowed(
  ctx: TestContext,
  token: string,
  role: RoleLabel,
): Promise<string> {
  const response = await ctx.request({
    method: 'POST',
    path: '/products',
    token,
    json: {
      code: uniqueSuffix(`${role.toLowerCase()}-product`).toUpperCase().slice(0, 64),
      name: `${role} Product`,
    },
  });

  assertStatus(response, 201, `${role}.products.create`);
  const product = readObject(asObject(response.body), 'product');
  return readString(product, 'id');
}

async function createFeaturedExpectAllowed(
  ctx: TestContext,
  token: string,
  productId: string,
  role: RoleLabel,
): Promise<string> {
  const response = await ctx.request({
    method: 'POST',
    path: '/featured-products',
    token,
    json: {
      productId,
    },
  });

  assertStatus(response, 201, `${role}.featured.create`);
  const item = readObject(asObject(response.body), 'item');
  return readString(item, 'id');
}

async function createShareExpectAllowed(
  ctx: TestContext,
  token: string,
  productId: string,
  role: RoleLabel,
): Promise<{ shareId: string; shareToken: string }> {
  const response = await ctx.request({
    method: 'POST',
    path: '/shares',
    token,
    json: {
      resourceType: 'product',
      resourceId: productId,
    },
  });

  assertStatus(response, 201, `${role}.shares.create`);
  const share = readObject(asObject(response.body), 'share');
  const shareId = readString(share, 'id');
  const shareToken = readString(share, 'shareToken');

  return { shareId, shareToken };
}

function requiredArg(value: string | undefined, flag: string): string {
  if (!value || value.trim().length === 0) {
    throw new ApiTestError(`account-matrix requires ${flag}`);
  }

  return value;
}
