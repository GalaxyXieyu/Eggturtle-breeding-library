import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  assertErrorCode,
  asObject,
  defaultEmail,
  loginWithDevCode,
} from './lib';

export const adminModule: TestModule = {
  name: 'admin',
  description: 'Admin endpoint deny/allow checks for tenant user and optional super-admin',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('admin');

  let checks = 0;

  const tenantUserEmail = ctx.options.email ?? defaultEmail('api-admin-role');
  const tenantUserLogin = await loginWithDevCode(ctx, tenantUserEmail);

  const tenantDeniedResponse = await ctx.request({
    method: 'GET',
    path: '/admin/tenants',
    token: tenantUserLogin.token,
  });
  if (tenantDeniedResponse.status !== 403) {
    throw new ApiTestError(
      `tenant-role admin endpoint check expected 403, got ${tenantDeniedResponse.status}`,
    );
  }
  assertErrorCode(tenantDeniedResponse, 'FORBIDDEN');
  checks += 1;

  let superAdminStatus: number | null = null;

  if (ctx.options.superAdminEmail) {
    const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);
    const superAdminResponse = await ctx.request({
      method: 'GET',
      path: '/admin/tenants',
      token: superAdminLogin.token,
    });

    superAdminStatus = superAdminResponse.status;
    if (ctx.options.requireSuperAdminPass) {
      if (superAdminResponse.status !== 200) {
        throw new ApiTestError(`super-admin check expected 200, got ${superAdminResponse.status}`);
      }
      const responseBody = asObject(superAdminResponse.body, 'admin.tenants super-admin response');
      if (!Array.isArray(responseBody.tenants)) {
        throw new ApiTestError('admin.tenants super-admin response missing tenants[]');
      }
    } else if (superAdminResponse.status !== 200) {
      ctx.log.warn('admin.super-admin.warn', {
        status: superAdminResponse.status,
        hint: 'Enable SUPER_ADMIN_ENABLED and include email in SUPER_ADMIN_EMAILS for positive checks.',
      });
    }

    checks += 1;
  }

  ctx.log.ok('admin.done', {
    checks,
    tenantUserEmail,
    superAdminStatus: superAdminStatus ?? 'skipped',
  });

  return {
    checks,
    details: {
      tenantUserEmail,
      superAdminStatus,
    },
  };
}
