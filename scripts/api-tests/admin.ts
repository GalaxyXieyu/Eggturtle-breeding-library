import {
  createAdminTenantResponseSchema,
  deleteTenantMemberResponseSchema,
  listAdminTenantMembersResponseSchema,
  listAdminTenantsResponseSchema,
  upsertTenantMemberResponseSchema,
} from '../../packages/shared/src/admin';

import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  assertErrorCode,
  assertStatus,
  defaultEmail,
  loginWithDevCode,
  uniqueSuffix,
} from './lib';

export const adminModule: TestModule = {
  name: 'admin',
  description: 'Admin endpoint deny/allow checks for tenant user and super-admin member revoke flow',
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
  assertStatus(tenantDeniedResponse, 403, 'tenant-role admin endpoint deny');
  assertErrorCode(tenantDeniedResponse, 'FORBIDDEN');
  checks += 1;

  let superAdminStatus: number | null = null;
  let removedMemberUserId: string | null = null;
  let removedTenantId: string | null = null;

  if (ctx.options.superAdminEmail) {
    const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);
    const superAdminResponse = await ctx.request({
      method: 'GET',
      path: '/admin/tenants',
      token: superAdminLogin.token,
    });

    superAdminStatus = superAdminResponse.status;
    checks += 1;

    if (ctx.options.requireSuperAdminPass && superAdminResponse.status !== 200) {
      throw new ApiTestError(`super-admin check expected 200, got ${superAdminResponse.status}`);
    }

    if (superAdminResponse.status === 200) {
      listAdminTenantsResponseSchema.parse(superAdminResponse.body);

      const tenantSlug = uniqueSuffix('admin-rm-member').slice(0, 80);
      const createTenantResponse = await ctx.request({
        method: 'POST',
        path: '/admin/tenants',
        token: superAdminLogin.token,
        json: {
          slug: tenantSlug,
          name: `Admin Remove Member ${Date.now()}`,
        },
      });
      assertStatus(createTenantResponse, 201, 'admin.create-tenant');
      const createTenantPayload = createAdminTenantResponseSchema.parse(createTenantResponse.body);
      const tenantId = createTenantPayload.tenant.id;
      checks += 1;

      const memberEmail = defaultEmail('api-admin-remove-member');
      const upsertMemberResponse = await ctx.request({
        method: 'POST',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminLogin.token,
        json: {
          email: memberEmail,
          role: 'EDITOR',
        },
      });
      assertStatus(upsertMemberResponse, 201, 'admin.upsert-member');
      const upsertMemberPayload = upsertTenantMemberResponseSchema.parse(upsertMemberResponse.body);
      checks += 1;

      const deleteMemberResponse = await ctx.request({
        method: 'DELETE',
        path: `/admin/tenants/${tenantId}/members/${upsertMemberPayload.user.id}`,
        token: superAdminLogin.token,
      });
      assertStatus(deleteMemberResponse, 200, 'admin.delete-member');
      const deleteMemberPayload = deleteTenantMemberResponseSchema.parse(deleteMemberResponse.body);
      if (deleteMemberPayload.tenantId !== tenantId) {
        throw new ApiTestError('admin.delete-member response tenantId mismatch');
      }
      if (deleteMemberPayload.userId !== upsertMemberPayload.user.id) {
        throw new ApiTestError('admin.delete-member response userId mismatch');
      }
      if (!deleteMemberPayload.removed) {
        throw new ApiTestError('admin.delete-member response removed should be true');
      }
      if (deleteMemberPayload.previousRole !== upsertMemberPayload.role) {
        throw new ApiTestError('admin.delete-member response previousRole mismatch');
      }
      checks += 1;

      const deleteMissingMemberResponse = await ctx.request({
        method: 'DELETE',
        path: `/admin/tenants/${tenantId}/members/${upsertMemberPayload.user.id}`,
        token: superAdminLogin.token,
      });
      assertStatus(deleteMissingMemberResponse, 404, 'admin.delete-member.missing');
      assertErrorCode(deleteMissingMemberResponse, 'TENANT_MEMBER_NOT_FOUND');
      checks += 1;

      const listMembersResponse = await ctx.request({
        method: 'GET',
        path: `/admin/tenants/${tenantId}/members`,
        token: superAdminLogin.token,
      });
      assertStatus(listMembersResponse, 200, 'admin.list-members.after-delete');
      const membersPayload = listAdminTenantMembersResponseSchema.parse(listMembersResponse.body);
      if (membersPayload.members.some((member) => member.user.id === upsertMemberPayload.user.id)) {
        throw new ApiTestError('admin.list-members.after-delete still contains removed member');
      }
      checks += 1;

      removedMemberUserId = upsertMemberPayload.user.id;
      removedTenantId = tenantId;
    } else {
      ctx.log.warn('admin.super-admin.warn', {
        status: superAdminResponse.status,
        hint: 'Enable SUPER_ADMIN_ENABLED and include email in SUPER_ADMIN_EMAILS for positive checks.',
      });
    }
  }

  ctx.log.ok('admin.done', {
    checks,
    tenantUserEmail,
    superAdminStatus: superAdminStatus ?? 'skipped',
    removedTenantId: removedTenantId ?? 'skipped',
    removedMemberUserId: removedMemberUserId ?? 'skipped',
  });

  return {
    checks,
    details: {
      tenantUserEmail,
      superAdminStatus,
      removedTenantId,
      removedMemberUserId,
    },
  };
}
